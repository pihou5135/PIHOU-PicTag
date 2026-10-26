import React, { useEffect, useId, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

export interface CoverageIssue {
  id: string;
  name: string;
  edges: string[];
}

interface CoverageDialogProps {
  issues: CoverageIssue[];
  onCancel: () => void;
  onConfirm: () => void;
}

const CoverageDialog: React.FC<CoverageDialogProps> = ({ issues, onCancel, onConfirm }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const decisionMadeRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    cancelButtonRef.current?.focus();
    return () => dialog.close();
  }, []);

  const decide = (action: () => void) => {
    if (decisionMadeRef.current) return;
    decisionMadeRef.current = true;
    action();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        decide(onCancel);
      }}
      className="m-auto w-[calc(100%_-_2rem)] max-w-lg max-h-[calc(100dvh_-_2rem)] rounded-2xl border-0 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/50"
    >
      <div className="flex flex-col p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-full bg-amber-100 p-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id={titleId} className="text-lg font-semibold">图片未铺满导出区域</h2>
            <p id={descriptionId} className="mt-2 text-sm leading-6 text-slate-600">
              以下 {issues.length} 张图片存在未覆盖的边缘。你可以返回调整；如果有意留白，也可以仍然导出。
            </p>
          </div>
        </div>

        <ul aria-label="未铺满的图片" className="my-5 max-h-[45vh] overflow-y-auto rounded-xl border border-amber-200 bg-amber-50 divide-y divide-amber-200">
          {issues.map((issue) => (
            <li key={issue.id} className="px-4 py-3">
              <p className="break-all text-sm font-medium" title={issue.name}>{issue.name}</p>
              <p className="mt-1 text-xs text-amber-800">未覆盖：{issue.edges.join('、')}边缘</p>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={() => decide(onCancel)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            返回调整
          </button>
          <button
            type="button"
            onClick={() => decide(onConfirm)}
            className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            仍然导出
          </button>
        </div>
      </div>
    </dialog>
  );
};

export default CoverageDialog;
