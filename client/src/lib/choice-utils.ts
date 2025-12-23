import type { DynamicOptionsConfig, ChoiceOption } from "@/../../shared/types/stepConfigs";

export function generateOptionsFromList(listData: any, config: DynamicOptionsConfig): ChoiceOption[] {
    if (config.type !== 'list') return [];

    const { labelColumnId, valueColumnId, dedupeBy, sort, labelTemplate } = config;

    let rawRows: any[] = [];
    let columnsMeta: any[] = [];

    // List Extraction (Same as before)
    if (listData && typeof listData === 'object' && listData.rows && Array.isArray(listData.rows)) {
        rawRows = listData.rows;
        columnsMeta = listData.columns || [];
    } else if (Array.isArray(listData)) {
        rawRows = listData;
    } else {
        return [];
    }

    // Sort by Column (Pre-Map)
    if (sort && sort.by === 'column' && sort.columnId) {
        // Clone to avoid mutating original
        rawRows = [...rawRows].sort((a, b) => {
            const valA = a[sort.columnId!] ?? '';
            const valB = b[sort.columnId!] ?? '';

            if (valA < valB) return sort.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sort.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    let opts = rawRows.map((row: any, idx: number) => {
        // Fallback options if columns missing
        const id = row[valueColumnId] || row.id || `opt-${idx}`;

        // Label Generation
        let label = "";
        if (labelTemplate) {
            label = labelTemplate.replace(/\{([^}]+)\}/g, (_, colName) => {
                // 1. Try to find column by Name in metadata
                if (columnsMeta.length > 0) {
                    const col = columnsMeta.find((c: any) => c.name === colName);
                    if (col && row[col.id] !== undefined) return String(row[col.id]);
                }
                // 2. Try direct key access
                if (row[colName] !== undefined) return String(row[colName]);

                return "";
            });
        } else {
            label = String(row[labelColumnId] || row[valueColumnId] || `Option ${idx}`);
        }

        // Alias/Value Generation
        const alias = String(row[valueColumnId] || row[labelColumnId] || `opt-${idx}`);

        return { id, label, alias };
    });

    // Dedupe
    if (dedupeBy === 'value') {
        const seen = new Set();
        opts = opts.filter(opt => {
            if (seen.has(opt.alias)) return false;
            seen.add(opt.alias);
            return true;
        });
    } else if (dedupeBy === 'label') {
        const seen = new Set();
        opts = opts.filter(opt => {
            if (seen.has(opt.label)) return false;
            seen.add(opt.label);
            return true;
        });
    }

    // Sort (Post-Map) - Skip if sorted by column
    if (sort && sort.by !== 'column') {
        opts.sort((a, b) => {
            let valA: string | number = a.alias;
            let valB: string | number = b.alias;

            if (sort.by === 'label') {
                valA = a.label;
                valB = b.label;
            }

            if (valA < valB) return sort.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sort.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    // Blank Option
    if (config.includeBlankOption) {
        opts.unshift({
            id: 'blank',
            label: config.blankLabel || '',
            alias: ''
        });
    }

    return opts;
}
