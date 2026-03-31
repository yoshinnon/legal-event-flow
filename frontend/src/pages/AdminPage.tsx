import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import ReactDiffViewer from "react-diff-viewer-continued";
import { useDocument } from "../hooks/useDocument";
import PublishModal from "../components/PublishModal";
import Toast, { type ToastType } from "../components/Toast";

const SLUG = "terms-of-service";

interface ToastState { message: string; type: ToastType }

export default function AdminPage() {
  const { document, currentVersion, isLoading, error, refetch } = useDocument(SLUG);
  const [newContent,    setNewContent]    = useState<string | null>(null);
  const [showModal,     setShowModal]     = useState(false);
  const [toast,         setToast]         = useState<ToastState | null>(null);

  // 初回ロード後に入力欄を現行バージョンで初期化
  const editorContent = newContent ?? currentVersion?.content ?? "";
  const hasChanges    = currentVersion !== null && editorContent !== currentVersion.content;

  const handleSuccess = useCallback(() => {
    setToast({ message: "反映しました", type: "success" });
    setNewContent(null);
    refetch();
  }, [refetch]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400">
        <svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">

      {/* ナビゲーションバー */}
      <nav className="flex-none border-b border-slate-700 bg-slate-900/90 backdrop-blur sticky top-0 z-20">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-white">Legal Event Flow</span>
            <span className="text-slate-600">|</span>
            <span className="text-sm text-slate-400">管理画面</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/terms"
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              公開ページを見る →
            </Link>
            {document && (
              <span className="px-2 py-0.5 bg-blue-900/50 border border-blue-700 text-blue-300 rounded text-xs font-mono">
                v{currentVersion?.versionNumber ?? "-"}
              </span>
            )}
          </div>
        </div>
      </nav>

      {/* エディタ */}
      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 49px)" }}>

        {/* 左: 入力エリア */}
        <div className="w-1/2 flex flex-col border-r border-slate-700">
          <div className="flex-none px-4 py-2 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono">新バージョン（編集中）</span>
            {hasChanges && (
              <span className="text-xs text-amber-400">● 未保存の変更あり</span>
            )}
          </div>
          <textarea
            className="flex-1 bg-slate-900 text-slate-200 text-sm font-mono p-4 resize-none focus:outline-none leading-relaxed"
            value={editorContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Markdownを入力..."
            spellCheck={false}
          />
        </div>

        {/* 右: 差分ビューア */}
        <div className="w-1/2 flex flex-col overflow-auto">
          <div className="flex-none px-4 py-2 bg-slate-800 border-b border-slate-700">
            <span className="text-xs text-slate-400 font-mono">差分プレビュー（現行 vs 新）</span>
          </div>
          {hasChanges ? (
            <div className="flex-1 overflow-auto text-xs">
              <ReactDiffViewer
                oldValue={currentVersion?.content ?? ""}
                newValue={editorContent}
                splitView={true}
                useDarkTheme={true}
                hideLineNumbers={false}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
              変更がありません
            </div>
          )}
        </div>
      </div>

      {/* フッター確定ボタン */}
      <div className="flex-none border-t border-slate-700 bg-slate-900 px-6 py-3 flex justify-end">
        <button
          onClick={() => setShowModal(true)}
          disabled={!hasChanges}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          確定して反映する
        </button>
      </div>

      {/* モーダル */}
      {showModal && currentVersion && (
        <PublishModal
          slug={SLUG}
          newContent={editorContent}
          currentContent={currentVersion.content}
          onSuccess={handleSuccess}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* トースト */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
