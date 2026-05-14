import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { FitAddon } from '@xterm/addon-fit';
import type { Terminal } from '@xterm/xterm';
import type { Project, ProjectSession } from '../../../types/app';
import { TERMINAL_INIT_DELAY_MS } from '../constants/constants';
import { getShellWebSocketUrl, parseShellMessage, sendSocketMessage } from '../utils/socket';

const ANSI_ESCAPE_REGEX =
  /(?:\[[0-?]*[ -/]*[@-~]|[0-?]*[ -/]*[@-~]|\][^]*(?:|\\)|[^]*(?:|)|[PX^_][^]*\\|[][^]*|[@-Z\\-_])/g;
const PROCESS_EXIT_REGEX = /Process exited with code (\d+)/;

/** Interval for the client-side keepalive ping (ms). */
const KEEPALIVE_INTERVAL_MS = 25_000;

/** Initial reconnect delay (ms). */
const RECONNECT_BASE_DELAY_MS = 2_000;

/** Maximum reconnect delay after exponential backoff (ms). */
const RECONNECT_MAX_DELAY_MS = 30_000;

/**
 * Auth-failure close codes (4000-4999): do not reconnect automatically.
 * Regular unexpected disconnects (1000, 1001, 1006, etc.) trigger auto-reconnect.
 */
const AUTH_FAILURE_CLOSE_CODE_MIN = 4000;
const AUTH_FAILURE_CLOSE_CODE_MAX = 4999;

type UseShellConnectionOptions = {
  wsRef: MutableRefObject<WebSocket | null>;
  terminalRef: MutableRefObject<Terminal | null>;
  fitAddonRef: MutableRefObject<FitAddon | null>;
  selectedProjectRef: MutableRefObject<Project | null | undefined>;
  selectedSessionRef: MutableRefObject<ProjectSession | null | undefined>;
  initialCommandRef: MutableRefObject<string | null | undefined>;
  isPlainShellRef: MutableRefObject<boolean>;
  onProcessCompleteRef: MutableRefObject<((exitCode: number) => void) | null | undefined>;
  isInitialized: boolean;
  autoConnect: boolean;
  closeSocket: () => void;
  clearTerminalScreen: () => void;
  setAuthUrl: (nextAuthUrl: string) => void;
  onOutputRef?: MutableRefObject<(() => void) | null>;
};

type UseShellConnectionResult = {
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  closeSocket: () => void;
  connectToShell: () => void;
  disconnectFromShell: () => void;
};

export function useShellConnection({
  wsRef,
  terminalRef,
  fitAddonRef,
  selectedProjectRef,
  selectedSessionRef,
  initialCommandRef,
  isPlainShellRef,
  onProcessCompleteRef,
  isInitialized,
  autoConnect,
  closeSocket,
  clearTerminalScreen,
  setAuthUrl,
  onOutputRef,
}: UseShellConnectionOptions): UseShellConnectionResult {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const connectingRef = useRef(false);

  // Reconnect state
  const userDisconnectedRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keepalive interval
  const keepaliveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearReconnectTimer() {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }

  function stopKeepalive() {
    if (keepaliveIntervalRef.current) {
      clearInterval(keepaliveIntervalRef.current);
      keepaliveIntervalRef.current = null;
    }
  }

  function startKeepalive(socket: WebSocket) {
    stopKeepalive();
    keepaliveIntervalRef.current = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'keepalive' }));
      }
    }, KEEPALIVE_INTERVAL_MS);
  }

  const handleProcessCompletion = useCallback(
    (output: string) => {
      if (!isPlainShellRef.current || !onProcessCompleteRef.current) {
        return;
      }

      const sanitizedOutput = output.replace(ANSI_ESCAPE_REGEX, '');
      const cleanOutput = sanitizedOutput;
      if (cleanOutput.includes('Process exited with code 0')) {
        onProcessCompleteRef.current(0);
        return;
      }

      const match = cleanOutput.match(PROCESS_EXIT_REGEX);
      if (!match) {
        return;
      }

      const exitCode = Number.parseInt(match[1], 10);
      if (!Number.isNaN(exitCode) && exitCode !== 0) {
        onProcessCompleteRef.current(exitCode);
      }
    },
    [isPlainShellRef, onProcessCompleteRef],
  );

  const handleSocketMessage = useCallback(
    (rawPayload: string) => {
      const message = parseShellMessage(rawPayload);
      if (!message) {
        console.error('[Shell] Error handling WebSocket message:', rawPayload);
        return;
      }

      if (message.type === 'output') {
        const output = typeof message.data === 'string' ? message.data : '';
        handleProcessCompletion(output);
        terminalRef.current?.write(output);
        onOutputRef?.current?.();
        return;
      }

      if (message.type === 'auth_url' || message.type === 'url_open') {
        const nextAuthUrl = typeof message.url === 'string' ? message.url : '';
        if (nextAuthUrl) {
          setAuthUrl(nextAuthUrl);
        }
      }
    },
    [handleProcessCompletion, onOutputRef, setAuthUrl, terminalRef],
  );

  // connectWebSocket is declared with useRef so it can reference itself for
  // reconnect scheduling without triggering dependency-array churn.
  const connectWebSocketRef = useRef<(isConnectionLocked?: boolean) => void>(() => {});

  const scheduleReconnect = useCallback(() => {
    clearReconnectTimer();

    const attempt = reconnectAttemptRef.current;
    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * 2 ** attempt,
      RECONNECT_MAX_DELAY_MS,
    );
    reconnectAttemptRef.current = attempt + 1;

    console.log(`[Shell] Reconnecting in ${delay}ms (attempt ${attempt + 1})`);

    reconnectTimerRef.current = setTimeout(() => {
      if (!userDisconnectedRef.current) {
        connectWebSocketRef.current(true);
      }
    }, delay);
  }, []);

  const connectWebSocket = useCallback(
    (isConnectionLocked = false) => {
      if ((connectingRef.current && !isConnectionLocked) || isConnecting || isConnected) {
        return;
      }

      try {
        const wsUrl = getShellWebSocketUrl();
        if (!wsUrl) {
          connectingRef.current = false;
          setIsConnecting(false);
          return;
        }

        connectingRef.current = true;

        const socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          setIsConnected(true);
          setIsConnecting(false);
          setIsReconnecting(false);
          connectingRef.current = false;
          reconnectAttemptRef.current = 0;
          setAuthUrl('');
          startKeepalive(socket);

          window.setTimeout(() => {
            const currentTerminal = terminalRef.current;
            const currentFitAddon = fitAddonRef.current;
            const currentProject = selectedProjectRef.current;
            if (!currentTerminal || !currentFitAddon || !currentProject) {
              return;
            }

            currentFitAddon.fit();

            sendSocketMessage(socket, {
              type: 'init',
              projectPath: currentProject.fullPath || currentProject.path || '',
              sessionId: isPlainShellRef.current ? null : selectedSessionRef.current?.id || null,
              hasSession: isPlainShellRef.current ? false : Boolean(selectedSessionRef.current),
              provider: isPlainShellRef.current ? 'plain-shell' : (selectedSessionRef.current?.__provider || localStorage.getItem('selected-provider') || 'claude'),
              cols: currentTerminal.cols,
              rows: currentTerminal.rows,
              initialCommand: initialCommandRef.current,
              isPlainShell: isPlainShellRef.current,
            });
          }, TERMINAL_INIT_DELAY_MS);
        };

        socket.onmessage = (event) => {
          const rawPayload = typeof event.data === 'string' ? event.data : String(event.data ?? '');
          handleSocketMessage(rawPayload);
        };

        socket.onclose = (event) => {
          stopKeepalive();
          setIsConnected(false);
          connectingRef.current = false;

          const isAuthFailure =
            event.code >= AUTH_FAILURE_CLOSE_CODE_MIN &&
            event.code <= AUTH_FAILURE_CLOSE_CODE_MAX;

          if (userDisconnectedRef.current || isAuthFailure) {
            // Intentional disconnect or auth failure — do not reconnect.
            setIsConnecting(false);
            setIsReconnecting(false);
            if (!userDisconnectedRef.current) {
              // Auth failure: leave terminal visible with error state.
              clearTerminalScreen();
            } else {
              clearTerminalScreen();
            }
            return;
          }

          // Unexpected disconnect — schedule auto-reconnect.
          setIsReconnecting(true);
          setIsConnecting(false);
          scheduleReconnect();
        };

        socket.onerror = () => {
          stopKeepalive();
          setIsConnected(false);
          setIsConnecting(false);
          connectingRef.current = false;
          // onclose will fire right after onerror, so reconnect logic lives there.
        };
      } catch {
        setIsConnected(false);
        setIsConnecting(false);
        setIsReconnecting(false);
        connectingRef.current = false;
      }
    },
    [
      clearTerminalScreen,
      fitAddonRef,
      handleSocketMessage,
      initialCommandRef,
      isConnected,
      isConnecting,
      isPlainShellRef,
      scheduleReconnect,
      selectedProjectRef,
      selectedSessionRef,
      setAuthUrl,
      terminalRef,
      wsRef,
    ],
  );

  // Keep the ref up-to-date so scheduleReconnect always calls the latest version.
  useEffect(() => {
    connectWebSocketRef.current = connectWebSocket;
  }, [connectWebSocket]);

  const connectToShell = useCallback(() => {
    if (!isInitialized || isConnected || isConnecting || connectingRef.current) {
      return;
    }

    userDisconnectedRef.current = false;
    reconnectAttemptRef.current = 0;
    clearReconnectTimer();
    connectingRef.current = true;
    setIsConnecting(true);
    connectWebSocket(true);
  }, [connectWebSocket, isConnected, isConnecting, isInitialized]);

  const disconnectFromShell = useCallback(() => {
    userDisconnectedRef.current = true;
    clearReconnectTimer();
    stopKeepalive();
    setIsReconnecting(false);
    closeSocket();
    clearTerminalScreen();
    setIsConnected(false);
    setIsConnecting(false);
    connectingRef.current = false;
    setAuthUrl('');
  }, [clearTerminalScreen, closeSocket, setAuthUrl]);

  useEffect(() => {
    if (!autoConnect || !isInitialized || isConnecting || isConnected) {
      return;
    }

    connectToShell();
  }, [autoConnect, connectToShell, isConnected, isConnecting, isInitialized]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearReconnectTimer();
      stopKeepalive();
    };
  }, []);

  return {
    isConnected,
    isConnecting,
    isReconnecting,
    closeSocket,
    connectToShell,
    disconnectFromShell,
  };
}
