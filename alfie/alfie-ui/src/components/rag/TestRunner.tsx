'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Plus,
  Trash2,
  Play,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useRAGStore } from '@/lib/rag/store';
import type { TestCase } from '@/lib/rag/types';
import * as api from '@/lib/rag/api';

interface TestRunnerProps {
  onClose: () => void;
}

interface TestCaseInput {
  name: string;
  query: string;
  minRelevantDocs: number;
  minScore: number;
  maxLatency: number;
}

export function TestRunner({ onClose }: TestRunnerProps) {
  const { currentPipelineId, testResults, setTestResults } = useRAGStore();
  const [testCases, setTestCases] = useState<TestCaseInput[]>([
    { name: 'Test 1', query: '', minRelevantDocs: 1, minScore: 0.5, maxLatency: 5000 },
  ]);
  const [isRunning, setIsRunning] = useState(false);

  const addTestCase = useCallback(() => {
    setTestCases((prev) => [
      ...prev,
      {
        name: `Test ${prev.length + 1}`,
        query: '',
        minRelevantDocs: 1,
        minScore: 0.5,
        maxLatency: 5000,
      },
    ]);
  }, []);

  const removeTestCase = useCallback((index: number) => {
    setTestCases((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateTestCase = useCallback(
    (index: number, updates: Partial<TestCaseInput>) => {
      setTestCases((prev) =>
        prev.map((tc, i) => (i === index ? { ...tc, ...updates } : tc))
      );
    },
    []
  );

  const runTests = useCallback(async () => {
    if (!currentPipelineId) return;

    setIsRunning(true);
    setTestResults(null);

    try {
      const formattedCases = testCases
        .filter((tc) => tc.query.trim())
        .map((tc) => ({
          name: tc.name,
          query: tc.query,
          expectedResults: {
            minRelevantDocs: tc.minRelevantDocs,
            minScore: tc.minScore,
            maxLatency: tc.maxLatency,
          },
        }));

      const results = await api.runTests(currentPipelineId, formattedCases);
      setTestResults(results.results);
    } catch (error) {
      console.error('Test run failed:', error);
    } finally {
      setIsRunning(false);
    }
  }, [currentPipelineId, testCases, setTestResults]);

  const getStatusIcon = (status: TestCase['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      className="w-96 border-l bg-card p-4 flex flex-col gap-4 overflow-y-auto"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Pipeline Tests</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4">
        {testCases.map((testCase, index) => (
          <Card key={index} className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Input
                value={testCase.name}
                onChange={(e) => updateTestCase(index, { name: e.target.value })}
                className="h-8 w-32"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => removeTestCase(index)}
                disabled={testCases.length === 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Query</Label>
              <Textarea
                value={testCase.query}
                onChange={(e) => updateTestCase(index, { query: e.target.value })}
                placeholder="Enter test query..."
                className="min-h-[60px] text-sm"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Min Docs</Label>
                <Input
                  type="number"
                  value={testCase.minRelevantDocs}
                  onChange={(e) =>
                    updateTestCase(index, { minRelevantDocs: parseInt(e.target.value) || 1 })
                  }
                  className="h-8"
                  min={1}
                />
              </div>
              <div>
                <Label className="text-xs">Min Score</Label>
                <Input
                  type="number"
                  value={testCase.minScore}
                  onChange={(e) =>
                    updateTestCase(index, { minScore: parseFloat(e.target.value) || 0 })
                  }
                  className="h-8"
                  min={0}
                  max={1}
                  step={0.1}
                />
              </div>
              <div>
                <Label className="text-xs">Max Latency (ms)</Label>
                <Input
                  type="number"
                  value={testCase.maxLatency}
                  onChange={(e) =>
                    updateTestCase(index, { maxLatency: parseInt(e.target.value) || 5000 })
                  }
                  className="h-8"
                  min={100}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Button variant="outline" className="w-full" onClick={addTestCase}>
        <Plus className="h-4 w-4 mr-2" />
        Add Test Case
      </Button>

      <Button
        className="w-full"
        onClick={runTests}
        disabled={isRunning || testCases.every((tc) => !tc.query.trim())}
      >
        {isRunning ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Running Tests...
          </>
        ) : (
          <>
            <Play className="h-4 w-4 mr-2" />
            Run Tests
          </>
        )}
      </Button>

      {testResults && testResults.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Results</span>
            <div className="flex gap-2">
              <Badge variant="default" className="bg-green-500">
                {testResults.filter((t) => t.status === 'passed').length} passed
              </Badge>
              <Badge variant="destructive">
                {testResults.filter((t) => t.status === 'failed').length} failed
              </Badge>
            </div>
          </div>

          {testResults.map((result) => (
            <Card key={result.id} className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(result.status)}
                  <span className="text-sm font-medium">{result.name}</span>
                </div>
                {result.result?.duration && (
                  <Badge variant="secondary">
                    {result.result.duration}ms
                  </Badge>
                )}
              </div>

              <p className="text-xs text-muted-foreground truncate">{result.query}</p>

              {result.result?.error && (
                <div className="mt-2 flex items-start gap-2 text-xs text-red-500">
                  <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>{result.result.error}</span>
                </div>
              )}

              {result.result?.evaluation && (
                <div className="mt-2 space-y-1 text-xs">
                  {Object.entries(result.result.evaluation).map(([key, val]) => {
                    if (!val) return null;
                    const evalData = val as { expected: number; actual: number; passed: boolean };
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-muted-foreground capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <span className={evalData.passed ? 'text-green-500' : 'text-red-500'}>
                          {typeof evalData.actual === 'number' 
                            ? evalData.actual.toFixed(2) 
                            : evalData.actual}
                          {' / '}
                          {evalData.expected}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
