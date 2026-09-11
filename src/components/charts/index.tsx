import React, { lazy, Suspense } from 'react';

const AreaChart = lazy(() => import('./Charts').then((module) => ({ default: module.AreaChartComponent })));
const LineChart = lazy(() => import('./Charts').then((module) => ({ default: module.LineChartComponent })));
const BarChart = lazy(() => import('./Charts').then((module) => ({ default: module.BarChartComponent })));
const DonutChart = lazy(() => import('./Charts').then((module) => ({ default: module.DonutChartComponent })));
const MultiLine = lazy(() => import('./Charts').then((module) => ({ default: module.MultiLineChart })));

const ChartFallback = () => (
  <div className="h-40 w-full animate-pulse rounded-xl bg-slate-100/70 dark:bg-slate-800/50" aria-label="Loading chart" />
);

export const AreaChartComponent = (props: React.ComponentProps<typeof AreaChart>) => (
  <Suspense fallback={<ChartFallback />}>
    <AreaChart {...props} />
  </Suspense>
);

export const LineChartComponent = (props: React.ComponentProps<typeof LineChart>) => (
  <Suspense fallback={<ChartFallback />}>
    <LineChart {...props} />
  </Suspense>
);

export const BarChartComponent = (props: React.ComponentProps<typeof BarChart>) => (
  <Suspense fallback={<ChartFallback />}>
    <BarChart {...props} />
  </Suspense>
);

export const DonutChartComponent = (props: React.ComponentProps<typeof DonutChart>) => (
  <Suspense fallback={<ChartFallback />}>
    <DonutChart {...props} />
  </Suspense>
);

export const MultiLineChart = (props: React.ComponentProps<typeof MultiLine>) => (
  <Suspense fallback={<ChartFallback />}>
    <MultiLine {...props} />
  </Suspense>
);
