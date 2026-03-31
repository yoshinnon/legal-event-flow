import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useDocument } from "../hooks/useDocument";

export default function TermsPage() {
  const { document, currentVersion, isLoading, error } = useDocument("terms-of-service");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-sm">読み込み中...</span>
        </div>
      </div>
    );
  }

  if (error || !document || !currentVersion) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-slate-400">
          <p className="text-lg font-medium text-slate-300 mb-2">現在ドキュメントを取得できません</p>
          <p className="text-sm">{error ?? "しばらく経ってから再度お試しください"}</p>
        </div>
      </div>
    );
  }

  const updatedAt = new Date(currentVersion.createdAt).toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* ヘッダー */}
      <header className="border-b border-slate-700 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-base font-medium text-white">{document.title}</h1>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <span className="px-2 py-0.5 bg-blue-900/50 border border-blue-700 text-blue-300 rounded text-xs font-mono">
              v{currentVersion.versionNumber}
            </span>
            <span>{updatedAt}</span>
          </div>
        </div>
      </header>

      {/* 本文 */}
      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="bg-white rounded-xl p-8 text-slate-800 shadow-lg">
          <article className="prose prose-slate max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {currentVersion.content}
            </ReactMarkdown>
          </article>
        </div>

        {document.description && (
          <p className="mt-4 text-xs text-slate-500 text-center">{document.description}</p>
        )}
      </main>
    </div>
  );
}
