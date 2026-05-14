import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ReleaseInfo } from "../../../types/sharedTypes";
import { copyTextToClipboard } from "../../../utils/clipboard";

// NOTE: The previous "Update Now" button that POSTed to /api/system/update
// (which ran `git pull && npm install` on the server) has been REMOVED.
// Auto-update was replaced by two manual-instruction modals (upstream + fork).
// See: UpstreamUpdateModal (this file) and ForkUpdateModal.tsx

interface VersionUpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    releaseInfo: ReleaseInfo | null;
    currentVersion: string;
    latestVersion: string | null;
    // installMode is no longer used but kept in signature to avoid breaking
    // callers that haven't been updated yet.
    installMode?: string;
}

export function VersionUpgradeModal({
    isOpen,
    onClose,
    releaseInfo,
    currentVersion,
    latestVersion,
}: VersionUpgradeModalProps) {
    const { t } = useTranslation('sidebar');
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const current = currentVersion;
    const latest = latestVersion ?? '?';

    // The prompt to paste into Claude Code so it can cherry-pick upstream changes.
    const prompt =
        `上游 siteboon/claudecodeui 发布了 ${latest}。当前 fork 版本 ${current}。\n` +
        `请用 gh 查看 v${current}..v${latest} 的改动，判断哪些对我们这个 fork 有意义，\n` +
        `应用相关变更，然后把 package.json 的 version 字段同步到 ${latest}。`;

    const compareUrl =
        `https://github.com/siteboon/claudecodeui/compare/v${current}...v${latest}`;

    const handleCopy = () => {
        copyTextToClipboard(prompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <button
                className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
                aria-label={t('update.dismiss')}
            />

            {/* Modal */}
            <div className="relative mx-4 max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-lg border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                            <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {t('update.upstreamModalTitle')}
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {releaseInfo?.title || `v${latest}`}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Version Info */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Current fork version</span>
                        <span className="font-mono text-sm text-gray-900 dark:text-white">v{current}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-700 dark:bg-blue-900/20">
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Upstream latest</span>
                        <span className="font-mono text-sm text-blue-900 dark:text-blue-100">v{latest}</span>
                    </div>
                </div>

                {/* Prompt block */}
                <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                        {t('update.copyPromptLabel', 'Claude Code prompt')}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t('update.copyPromptHint', 'Paste this into Claude Code — it will review upstream changes and apply what is relevant to this fork.')}
                    </p>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-700/50">
                        <pre className="whitespace-pre-wrap font-mono text-xs text-gray-700 dark:text-gray-300">
                            {prompt}
                        </pre>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                    <button
                        onClick={onClose}
                        className="flex-1 rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                        {t('update.dismiss')}
                    </button>
                    <button
                        onClick={handleCopy}
                        className="flex-1 rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                        {copied ? t('update.copied', 'Copied!') : t('update.copyPrompt')}
                    </button>
                    <a
                        href={compareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-1 items-center justify-center gap-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                    >
                        {t('update.viewChanges')}
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </a>
                </div>
            </div>
        </div>
    );
}
