'use client'

import { useState, useRef } from 'react'
import { Check, Copy } from 'lucide-react'

interface CodeBlockProps {
    children: React.ReactNode
    className?: string
    title?: string
    'data-language'?: string
}

export function CodeBlock({ children, className, title, 'data-language': language }: CodeBlockProps) {
    const [copied, setCopied] = useState(false)
    const preRef = useRef<HTMLPreElement>(null)

    const onCopy = () => {
        if (!preRef.current) return

        // Find the code element inside pre
        const codeElement = preRef.current.querySelector('code')
        const text = codeElement ? codeElement.innerText : preRef.current.innerText

        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="my-8 overflow-hidden rounded-2xl border border-black/10 bg-neutral-950 dark:border-white/10 group relative">
            {/* Header: language label and copy button */}
            <div className="flex items-center justify-between border-b border-white/5 bg-neutral-900/50 px-4 py-2">
                <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                    {title || language}
                </span>

                <button
                    onClick={onCopy}
                    className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white group/btn"
                    title="Copy code"
                    aria-label="Copy code"
                >
                    {copied ? (
                        <Check className="w-4 h-4 text-green-400" />
                    ) : (
                        <Copy className="w-4 h-4 transition-transform group-hover/btn:scale-110" />
                    )}
                </button>
            </div>

            {/* Code Content */}
            <div className="relative overflow-hidden">
                <pre
                    ref={preRef}
                    className={`
                        bg-transparent! mb-0 px-6 pt-4 pb-6 text-sm leading-relaxed overflow-auto max-h-[600px]
                        [&::selection]:bg-brand/30 [&_::selection]:bg-brand/30
                        [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5
                        [&::-webkit-scrollbar-track]:bg-transparent
                        [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10
                        [&::-webkit-scrollbar-thumb:hover]:bg-white/20
                        [&_code]:bg-transparent! [&_code]:p-0! [&_code]:text-[#e5e5e5]!
                        [&_[data-line]]:border-l-[3px] [&_[data-line]]:border-transparent [&_[data-line]]:px-2
                        [&_[data-highlighted-line]]:border-l-brand [&_[data-highlighted-line]]:bg-white/5
                        ${className || ''}
                    `}
                    style={{
                      scrollbarWidth: 'thin',
                      scrollbarColor: 'rgba(255,255,255,0.1) transparent',
                    }}
                >
                    <div style={{ width: 'max-content', minWidth: '100%' }}>
                        {children}
                    </div>
                </pre>
            </div>
        </div>
    )
}
