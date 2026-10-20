/**
 * Engagement analytics through the site's existing PostHog project: cookieless, only on the
 * production hosts, and a no-op everywhere else (local dev, the private preview, forks).
 */

const HOSTS = ['mikkeyboi.github.io', 'minwahleung.ca', 'www.minwahleung.ca'];
/** Public client-side ingestion key, the same one the blog pages use. */
const KEY = 'phc_sv4c27kk3dsCZCXprfJQQG3JMura4hFkzjbp4L69RN89';
const API = 'https://us.i.posthog.com';

type Props = Record<string, string | number | boolean>;
interface PostHog { capture(event: string, props?: Props): void; register(props: Props): void; init(key: string, cfg: object): void }
declare global { interface Window { posthog?: PostHog & { _q?: unknown[] } } }

const once = new Set<string>();
let enabled = false;

/** Load PostHog's loader with a queueing stub, mirroring their official snippet. `surface` tags the page kind. */
export function initAnalytics(surface: string): void {
  if (!HOSTS.includes(location.hostname) || window.posthog) return;
  const queue: unknown[] = [];
  const stub = { _q: queue } as unknown as PostHog & { _q: unknown[] };
  for (const m of ['init', 'capture', 'register']) (stub as unknown as Record<string, unknown>)[m] = (...args: unknown[]) => queue.push([m, ...args]);
  window.posthog = stub;
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = API.replace('.i.posthog.com', '-assets.i.posthog.com') + '/static/array.js';
  s.onload = () => {
    // array.js replaces window.posthog with the real client; replay what was queued.
    const ph = window.posthog;
    if (!ph || ph === stub) return;
    for (const [m, ...args] of queue as [keyof PostHog, ...unknown[]][]) (ph[m] as (...a: unknown[]) => void)(...args);
  };
  document.head.append(s);
  window.posthog.init(KEY, {
    api_host: API,
    defaults: '2026-05-30',
    persistence: 'memory',
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,
    disable_session_recording: false,
    mask_all_text: false,
    mask_all_element_attributes: false,
  });
  window.posthog.register({ surface });
  enabled = true;
}

export function track(event: string, props: Props = {}): void {
  if (enabled) window.posthog?.capture(event, props);
}

/** Track an event at most once per page view for a given key. */
export function trackOnce(key: string, event: string, props: Props = {}): void {
  if (once.has(key)) return;
  once.add(key);
  track(event, props);
}
