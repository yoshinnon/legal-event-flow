import { useState } from "react";
import { api } from "../api/client";
import type { PublishPayload } from "../types";

interface PublishModalProps {
  slug:           string;
  newContent:     string;
  currentContent: string;
  onSuccess:      () => void;
  onClose:        () => void;
}

type Mode = "immediate" | "scheduled";

export default function PublishModal({
  slug, newContent, currentContent, onSuccess, onClose,
}: PublishModalProps) {
  const [mode,        setMode]        = useState<Mode>("immediate");
  const [dateTimeVal, setDateTimeVal] = useState("");
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // 差分サマリーを簡易生成
  const diffSummary = `${currentContent.length} → ${newContent.length} 文字（管理画面から更新）`;

  // applyAt（UNIX Timestamp秒）
  const applyAtSec = dateTimeVal ? Math.floor(new Date(dateTimeVal).getTime() / 1000) : null;
  const isPastDate  = applyAtSec !== null && applyAtSec <= Math.floor(Date.now() / 1000);
  const canSubmit   = !isLoading && (mode === "immediate" || (dateTimeVal !== "" && !isPastDate));

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const payload: PublishPayload = {
        content:     newContent,
        diffSummary,
        status:      "published",
        ...(mode === "scheduled" && applyAtSec ? { applyAt: applyAtSec } : {}),
      };
      await api.publishVersion(slug, payload);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "送信に失敗しました");
      setIsLoading(false);
    }
  };

  return (
    // オーバーレイ（外クリックでキャンセル）
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-slate-800 border border-slate-600 rounded-xl w-full max-w-md mx-4 p-6 shadow-2xl">
        <h2 className="text-lg font-medium text-white mb-5">反映方法を選択</h2>

        {/* 即時反映 */}
        <label className="flex items-start gap-3 mb-4 cursor-pointer group">
          <input
            type="radio"
            name="mode"
            value="immediate"
            checked={mode === "immediate"}
            onChange={() => setMode("immediate")}
            className="mt-1 accent-blue-500"
          />
          <div>
            <p className="text-white text-sm font-medium">即時反映</p>
            <p className="text-slate-400 text-xs mt-0.5">確定後すぐに公開されます</p>
          </div>
        </label>

        {/* 日時指定 */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="radio"
            name="mode"
            value="scheduled"
            checked={mode === "scheduled"}
            onChange={() => setMode("scheduled")}
            className="mt-1 accent-blue-500"
          />
          <div className="flex-1">
            <p className="text-white text-sm font-medium">日時指定（予約反映）</p>
            <p className="text-slate-400 text-xs mt-0.5">指定した日時に自動公開されます</p>
            {mode === "scheduled" && (
              <div className="mt-2">
                <input
                  type="datetime-local"
                  value={dateTimeVal}
                  onChange={(e) => setDateTimeVal(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-500 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                />
                {isPastDate && (
                  <p className="text-red-400 text-xs mt-1">過去の日時は指定できません</p>
                )}
              </div>
            )}
          </div>
        </label>

        {error && (
          <p className="mt-4 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 mt-6 justify-end">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm text-slate-300 hover:text-white border border-slate-600 rounded-lg transition-colors disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading && (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {mode === "immediate" ? "今すぐ反映" : "予約確定"}
          </button>
        </div>
      </div>
    </div>
  );
}
