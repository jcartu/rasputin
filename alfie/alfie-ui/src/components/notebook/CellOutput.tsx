'use client';

import { memo, useMemo } from 'react';
import { AlertCircle, Terminal, Image as ImageIcon } from 'lucide-react';
import type { CellOutput as CellOutputType, MimeBundle } from '@/lib/notebook/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';

interface CellOutputProps {
  outputs: CellOutputType[];
  executionCount?: number | null;
}

export const CellOutput = memo(function CellOutput({ outputs, executionCount }: CellOutputProps) {
  if (!outputs || outputs.length === 0) return null;

  return (
    <div className="border-t border-border/50 bg-muted/30">
      {outputs.map((output, index) => (
        <OutputItem key={`${output.output_type}-${index}`} output={output} />
      ))}
    </div>
  );
});

const OutputItem = memo(function OutputItem({ output }: { output: CellOutputType }) {
  switch (output.output_type) {
    case 'stream':
      return <StreamOutput output={output} />;
    case 'display_data':
    case 'execute_result':
      return <DisplayOutput output={output} />;
    case 'error':
      return <ErrorOutput output={output} />;
    default:
      return null;
  }
});

const StreamOutput = memo(function StreamOutput({ 
  output 
}: { 
  output: { output_type: 'stream'; name: string; text: string } 
}) {
  const isError = output.name === 'stderr';
  
  return (
    <div className={`px-4 py-2 font-mono text-sm ${isError ? 'text-red-400 bg-red-950/20' : 'text-foreground'}`}>
      <div className="flex items-start gap-2">
        <Terminal className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
        <pre className="whitespace-pre-wrap break-words overflow-x-auto">
          {output.text}
        </pre>
      </div>
    </div>
  );
});

const DisplayOutput = memo(function DisplayOutput({ 
  output 
}: { 
  output: { output_type: 'display_data' | 'execute_result'; data: MimeBundle; metadata: Record<string, unknown> } 
}) {
  const { data } = output;
  
  const content = useMemo(() => {
    if (data['text/html']) {
      return <HtmlOutput html={data['text/html']} />;
    }
    
    if (data['image/png']) {
      return <ImageOutput base64={data['image/png']} format="png" />;
    }
    
    if (data['image/jpeg']) {
      return <ImageOutput base64={data['image/jpeg']} format="jpeg" />;
    }
    
    if (data['image/svg+xml']) {
      return <SvgOutput svg={data['image/svg+xml']} />;
    }
    
    if (data['image/gif']) {
      return <ImageOutput base64={data['image/gif']} format="gif" />;
    }
    
    if (data['text/markdown']) {
      return <MarkdownOutput markdown={data['text/markdown']} />;
    }
    
    if (data['text/latex']) {
      return <LatexOutput latex={data['text/latex']} />;
    }
    
    if (data['application/json']) {
      return <JsonOutput json={data['application/json']} />;
    }
    
    if (data['application/vnd.plotly.v1+json']) {
      return <PlotlyPlaceholder />;
    }
    
    if (data['application/vnd.vegalite.v4+json']) {
      return <VegaLitePlaceholder />;
    }
    
    if (data['text/plain']) {
      return <PlainTextOutput text={data['text/plain']} />;
    }
    
    return <div className="text-muted-foreground italic">Unknown output type</div>;
  }, [data]);

  return (
    <div className="px-4 py-2 overflow-x-auto">
      {content}
    </div>
  );
});

const ErrorOutput = memo(function ErrorOutput({ 
  output 
}: { 
  output: { output_type: 'error'; ename: string; evalue: string; traceback: string[] } 
}) {
  return (
    <div className="px-4 py-2 bg-red-950/30 border-l-4 border-red-500">
      <div className="flex items-center gap-2 text-red-400 font-medium mb-2">
        <AlertCircle className="w-4 h-4" />
        <span>{output.ename}: {output.evalue}</span>
      </div>
      <pre className="font-mono text-sm text-red-300 whitespace-pre-wrap overflow-x-auto">
        {output.traceback.map(stripAnsi).join('\n')}
      </pre>
    </div>
  );
});

const HtmlOutput = memo(function HtmlOutput({ html }: { html: string }) {
  return (
    <div 
      className="notebook-html-output prose prose-invert prose-sm max-w-none overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
});

const ImageOutput = memo(function ImageOutput({ 
  base64, 
  format 
}: { 
  base64: string; 
  format: 'png' | 'jpeg' | 'gif' 
}) {
  return (
    <div className="flex justify-center">
      <img 
        src={`data:image/${format};base64,${base64}`}
        alt="Output"
        className="max-w-full h-auto rounded border border-border"
        style={{ maxHeight: '500px' }}
      />
    </div>
  );
});

const SvgOutput = memo(function SvgOutput({ svg }: { svg: string }) {
  return (
    <div 
      className="flex justify-center notebook-svg-output"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
});

const MarkdownOutput = memo(function MarkdownOutput({ markdown }: { markdown: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeRaw]}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
});

const LatexOutput = memo(function LatexOutput({ latex }: { latex: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {`$$${latex}$$`}
      </ReactMarkdown>
    </div>
  );
});

const JsonOutput = memo(function JsonOutput({ json }: { json: unknown }) {
  const formatted = useMemo(() => {
    try {
      return JSON.stringify(json, null, 2);
    } catch {
      return String(json);
    }
  }, [json]);

  return (
    <pre className="font-mono text-sm bg-muted/50 rounded p-3 overflow-x-auto">
      <code>{formatted}</code>
    </pre>
  );
});

const PlainTextOutput = memo(function PlainTextOutput({ text }: { text: string }) {
  const isTable = text.includes('│') || text.includes('|') || text.includes('─') || text.includes('+--');
  
  return (
    <pre className={`font-mono text-sm whitespace-pre-wrap ${isTable ? 'text-xs' : ''}`}>
      {text}
    </pre>
  );
});

const PlotlyPlaceholder = memo(function PlotlyPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-muted/30 rounded border border-dashed border-border">
      <ImageIcon className="w-12 h-12 text-muted-foreground mb-2" />
      <p className="text-muted-foreground text-sm">Plotly chart (interactive rendering not available)</p>
    </div>
  );
});

const VegaLitePlaceholder = memo(function VegaLitePlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-muted/30 rounded border border-dashed border-border">
      <ImageIcon className="w-12 h-12 text-muted-foreground mb-2" />
      <p className="text-muted-foreground text-sm">Vega-Lite chart (interactive rendering not available)</p>
    </div>
  );
});

function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  const ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
  return text.replace(ansiRegex, '');
}

function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const scripts = Array.from(doc.querySelectorAll('script'));
  scripts.forEach(script => script.remove());
  
  const elements = Array.from(doc.querySelectorAll('*'));
  elements.forEach(el => {
    const attrs = el.attributes;
    for (let i = attrs.length - 1; i >= 0; i--) {
      const attr = attrs[i];
      if (attr.name.startsWith('on') || attr.value.includes('javascript:')) {
        el.removeAttribute(attr.name);
      }
    }
  });
  
  return doc.body.innerHTML;
}
