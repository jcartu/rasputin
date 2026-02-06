'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, Download, Terminal, FileCode, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

import { usePlaygroundStore } from '@/lib/playground/store';
import { generateCode, CODE_LANGUAGE_INFO } from '@/lib/playground/codeGen';

const LANGUAGES = ['curl', 'javascript', 'python', 'go', 'rust'] as const;

export function CodeGenerator() {
  const { currentRequest, codeLanguage, setCodeLanguage, setShowCodeGenerator } = usePlaygroundStore();
  const [copied, setCopied] = useState(false);

  const code = useMemo(() => {
    return generateCode(currentRequest, codeLanguage);
  }, [currentRequest, codeLanguage]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleDownload = useCallback(() => {
    const info = CODE_LANGUAGE_INFO[codeLanguage];
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `request.${info.extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [code, codeLanguage]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 p-3 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <FileCode className="w-4 h-4" />
          Code Generator
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setShowCodeGenerator(false)}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-shrink-0 border-b border-border">
        <div className="flex overflow-x-auto">
          {LANGUAGES.map((lang) => {
            const info = CODE_LANGUAGE_INFO[lang];
            return (
              <button
                key={lang}
                type="button"
                onClick={() => setCodeLanguage(lang)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2',
                  codeLanguage === lang
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {lang === 'curl' ? (
                  <Terminal className="w-4 h-4" />
                ) : (
                  <FileCode className="w-4 h-4" />
                )}
                {info.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-shrink-0 p-2 border-b border-border flex items-center justify-end gap-1">
        <Button variant="ghost" size="sm" className="h-8 gap-2" onClick={handleCopy}>
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy
            </>
          )}
        </Button>
        <Button variant="ghost" size="sm" className="h-8 gap-2" onClick={handleDownload}>
          <Download className="w-3.5 h-3.5" />
          Download
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <pre className="p-4 text-sm font-mono leading-relaxed">
          <CodeHighlight code={code} language={codeLanguage} />
        </pre>
      </ScrollArea>
    </div>
  );
}

interface CodeHighlightProps {
  code: string;
  language: string;
}

function CodeHighlight({ code, language }: CodeHighlightProps) {
  const highlighted = useMemo(() => {
    let result = code;

    result = result.replace(/('[^']*'|"[^"]*")/g, '<span class="text-amber-500">$1</span>');

    const keywords = {
      curl: ['curl', '-X', '-H', '-d', '-F', '--data-urlencode'],
      javascript: ['const', 'let', 'var', 'await', 'async', 'try', 'catch', 'if', 'else', 'return', 'function', 'new'],
      python: ['import', 'from', 'def', 'try', 'except', 'if', 'else', 'return', 'as', 'with'],
      go: ['package', 'import', 'func', 'var', 'const', 'if', 'else', 'return', 'defer', 'err'],
      rust: ['use', 'fn', 'let', 'mut', 'async', 'await', 'if', 'else', 'Ok', 'Err', 'pub', 'struct'],
    };

    const langKeywords = keywords[language as keyof typeof keywords] || [];
    langKeywords.forEach((keyword) => {
      const regex = new RegExp(`\\b(${keyword})\\b`, 'g');
      result = result.replace(regex, '<span class="text-purple-500 font-semibold">$1</span>');
    });

    result = result.replace(/(\/\/[^\n]*)/g, '<span class="text-muted-foreground italic">$1</span>');
    result = result.replace(/(#[^\n]*)/g, '<span class="text-muted-foreground italic">$1</span>');

    result = result.replace(/\b(\d+)\b/g, '<span class="text-emerald-500">$1</span>');

    return result;
  }, [code, language]);

  return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
}
