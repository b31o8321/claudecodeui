import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ReleaseInfo } from "../../../types/sharedTypes";
import { copyTextToClipboard } from "../../../utils/clipboard";

interface ForkUpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    releaseInfo: ReleaseInfo | null;
    currentVersion: string;
    latestVersion: string | null;
}

// Clean up changelog body (same logic as original VersionUpgradeModal)
const cleanChangelog = (body: string) => {
    if (!body) return '';
    return body
        .replace(/\b[0-9a-f]{40}\b/gi, '')
        .replace(/(?:^|\s|-)([0-9a-f]{7,10})\b/gi, '')
        .replace(/\*\*Full Changelog\*\*:.*$/gim, '')
        .replace(/https?:\/\/github\.com\/[^/]+\/[^/]+\/compare\/[^\s)]+/gi, '')
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();
};

export function ForkUpdateModal({
    isOpen,
    onClose,
    releaseInfo,
    currentVersion,
    latestVersion,
}: ForkUpdateModalProps) {
    const { t } = useTranslation('sidebar');
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const latest = latestVersion ?? '?';

    const instructions =
        `cd <your-install-dir>\ngit pull origin main\nnpm install\n# restart the dev server`;

    const handleCopy = () => {
        copyTextToClipboard(instructions);
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
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                            <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {t('update.forkModalTitle')}
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
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Current version</span>
                        <span className="font-mono text-sm text-gray-900 dark:text-white">v{currentVersion}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-700 dark:bg-green-900/20">
                        <span className="text-sm font-medium text-green-700 dark:text-green-300">Fork latest release</span>
                        <span className="font-mono text-sm text-green-900 dark:text-green-100">v{latest}</span>
                    </div>
                </div>

                {/* Release notes */}
                {releaseInfo?.body && (
                    <div className="space-y-2">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">Release notes</h3>
                        <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-700/50">
                            <pre className="whitespace-pre-wrap font-mono text-xs text-gray-700 dark:text-gray-300">
                                {cleanChangelog(releaseInfo.body)}
                            </pre>
                        </div>
                    </div>
                )}

                {/* Instructions */}
                <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                        {t('update.copyInstructionsLabel', 'Update instructions')}
                    </h3>
                    <div className="rounded-lg border border-gray-200 bg-gray-900 p-4 dark:border-gray-600">
                        <pre className="whitespace-pre-wrap font-mono text-xs text-green-400">
                            {instructions}
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
                        {copied ? t('update.copied', 'Copied!') : t('update.copyInstructions')}
                    </button>
                    {releaseInfo?.htmlUrl && (
                        <a
                            href={releaseInfo.htmlUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-1 items-center justify-center gap-1 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
                        >
                            {t('update.viewRelease')}
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}
