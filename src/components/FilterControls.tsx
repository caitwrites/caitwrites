interface FilterOption { label: string; value: string }
interface Filter { key: string; label: string; options: FilterOption[] }

export function FilterControls({ filters, values, onChange, onClear, active, showClear = true }: { filters: Filter[]; values: Record<string, string>; onChange: (key: string, value: string) => void; onClear: () => void; active: boolean; showClear?: boolean }) {
  return (
    <div className="filter-bar">
      <div className="flex flex-1 flex-wrap gap-4">
        {filters.map((filter) => <label key={filter.key}><span>{filter.label}</span><select value={values[filter.key] || ''} onChange={(event) => onChange(filter.key, event.target.value)}>{filter.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>)}
      </div>
      {showClear && <button className="clear-button" onClick={onClear} disabled={!active}>Clear filters</button>}
    </div>
  );
}
