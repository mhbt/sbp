import React from 'react'

/* ── Styled wrappers for markdown tables ────────────────────────── */

export function MdxTable(props: React.HTMLAttributes<HTMLTableElement>) {
    return (
        <div className="my-8 -mx-4 sm:mx-0 overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
            <table
                {...props}
                className="w-full text-sm border-collapse min-w-[420px]"
            />
        </div>
    )
}

export function MdxThead(props: React.HTMLAttributes<HTMLTableSectionElement>) {
    return (
        <thead
            {...props}
            className="bg-neutral-100 dark:bg-neutral-900 text-left"
        />
    )
}

export function MdxTbody(props: React.HTMLAttributes<HTMLTableSectionElement>) {
    return <tbody {...props} className="divide-y divide-neutral-100 dark:divide-neutral-800/60" />
}

export function MdxTr(props: React.HTMLAttributes<HTMLTableRowElement>) {
    return (
        <tr
            {...props}
            className="transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/40"
        />
    )
}

export function MdxTh(props: React.ThHTMLAttributes<HTMLTableCellElement>) {
    return (
        <th
            {...props}
            className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 whitespace-nowrap"
        />
    )
}

export function MdxTd(props: React.TdHTMLAttributes<HTMLTableCellElement>) {
    return (
        <td
            {...props}
            className="px-4 py-3 text-neutral-700 dark:text-neutral-300 font-medium"
        />
    )
}
