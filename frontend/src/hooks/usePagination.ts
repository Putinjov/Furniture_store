import { useState, useCallback, useRef } from 'react';

interface UsePaginationOptions<T> {
  fetchFunction: (skip: number, limit: number) => Promise<T[]>;
  pageSize?: number;
}

interface UsePaginationResult<T> {
  data: T[];
  loading: boolean;
  refreshing: boolean;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T[]>>;
}

export function usePagination<T>({
  fetchFunction,
  pageSize = 20,
}: UsePaginationOptions<T>): UsePaginationResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const skipRef = useRef(0);
  const isLoadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (isLoadingRef.current || !hasMore) return;

    isLoadingRef.current = true;
    setLoading(true);

    try {
      const newItems = await fetchFunction(skipRef.current, pageSize);
      
      if (newItems.length < pageSize) {
        setHasMore(false);
      }

      if (skipRef.current === 0) {
        setData(newItems);
      } else {
        setData(prev => [...prev, ...newItems]);
      }

      skipRef.current += newItems.length;
    } catch (error) {
      console.error('Pagination error:', error);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [fetchFunction, pageSize, hasMore]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    skipRef.current = 0;
    setHasMore(true);
    isLoadingRef.current = false;

    try {
      const newItems = await fetchFunction(0, pageSize);
      setData(newItems);
      
      if (newItems.length < pageSize) {
        setHasMore(false);
      }
      
      skipRef.current = newItems.length;
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchFunction, pageSize]);

  return {
    data,
    loading,
    refreshing,
    hasMore,
    loadMore,
    refresh,
    setData,
  };
}
