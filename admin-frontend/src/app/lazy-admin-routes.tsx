import { Suspense, lazy, type ComponentType, type LazyExoticComponent } from "react";

import { WorkspaceRouteSkeleton } from "@/components/primitives/WorkspaceRouteSkeleton";

const lazyModuleLoaders = import.meta.glob("../features/**/*.tsx");
const lazyComponentCache = new Map<string, LazyExoticComponent<ComponentType<Record<string, unknown>>>>();
const preloadCache = new Map<string, Promise<void>>();

export const preloadLazyNamedComponent = (modulePath: string, exportName: string) => {
  const cacheKey = `${modulePath}:${exportName}`;
  const existing = preloadCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const loader = lazyModuleLoaders[modulePath];
  if (!loader) {
    return Promise.reject(new Error(`Lazy route module not found: ${modulePath}`));
  }

  const preloadPromise = loader().then((mod) => {
    const namedExport = (mod as Record<string, unknown>)[exportName];
    if (typeof namedExport !== "function") {
      throw new Error(`Lazy route export not found: ${exportName} from ${modulePath}`);
    }
  });

  preloadCache.set(cacheKey, preloadPromise);
  return preloadPromise;
};

export const getLazyNamedComponent = (modulePath: string, exportName: string) => {
  const cacheKey = `${modulePath}:${exportName}`;
  const existing = lazyComponentCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const loader = lazyModuleLoaders[modulePath];
  if (!loader) {
    throw new Error(`Lazy route module not found: ${modulePath}`);
  }

  const component = lazy(async () => {
    const mod = (await loader()) as Record<string, unknown>;
    const namedExport = mod[exportName];
    if (typeof namedExport !== "function") {
      throw new Error(`Lazy route export not found: ${exportName} from ${modulePath}`);
    }
    return {
      default: namedExport as ComponentType<Record<string, unknown>>
    };
  });

  lazyComponentCache.set(cacheKey, component);
  return component;
};

export const renderLazyRoute = (
  modulePath: string,
  exportName: string,
  props?: Record<string, unknown>
) => {
  const Component = getLazyNamedComponent(modulePath, exportName);

  return (
    <Suspense fallback={<WorkspaceRouteSkeleton />}>
      <Component {...(props ?? {})} />
    </Suspense>
  );
};
