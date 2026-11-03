export const INPUT =
  "w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors bg-white";

export const INPUT_ERROR = "border-red-400 focus:ring-red-100 focus:border-red-400";

export function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

export function ReadOnlyField({ value }) {
  return (
    <div className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-400 bg-gray-100 select-none">
      {value || <span className="italic">—</span>}
    </div>
  );
}
