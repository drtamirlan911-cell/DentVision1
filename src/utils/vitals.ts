import type { Metric } from 'web-vitals';

function reportMetric(metric: Metric) {
  if (import.meta.env.DEV) {
    console.log(`[WebVitals] ${metric.name}`, metric.value, metric.rating);
  }
}

export function reportWebVitals() {
  if (typeof window === 'undefined') return;
  import('web-vitals').then(({ onCLS, onLCP, onTTFB, onINP }) => {
    onCLS(reportMetric);
    onLCP(reportMetric);
    onTTFB(reportMetric);
    onINP(reportMetric);
  }).catch(() => {});
}
