// Pure utility functions for data formatting and calculations

export const formatters = {
  // Currency formatting
  currency: (amount: number | null | undefined): string => {
    if (amount == null || isNaN(amount)) return '$0.0000';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
    }).format(amount);
  },

  // Token formatting with K/M suffixes
  tokens: (count: number | null | undefined): string => {
    if (count == null || isNaN(count)) return '0';
    if (count >= 1_000_000) {
      return `${(count / 1_000_000).toFixed(1)}M`;
    }
    if (count >= 1_000) {
      return `${(count / 1_000).toFixed(1)}K`;
    }
    return count.toLocaleString();
  },

  // Date formatting
  date: (dateString: string): string => {
    return new Date(dateString).toLocaleDateString();
  },

  datetime: (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  },

  timeAgo: (dateString: string): string => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatters.date(dateString);
  },

  // Duration formatting
  duration: (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  },

  // Percentage formatting
  percentage: (value: number, total: number): string => {
    if (total === 0) return '0%';
    return `${((value / total) * 100).toFixed(1)}%`;
  },

  // Number formatting with commas
  number: (num: number | null | undefined): string => {
    if (num == null || isNaN(num)) return '0';
    return num.toLocaleString();
  },
};

export const calculations = {
  // Cost calculations
  costPerToken: (cost: number | null | undefined, tokens: number | null | undefined): number => {
    const safeCost = cost ?? 0;
    const safeTokens = tokens ?? 0;
    return safeTokens > 0 ? safeCost / safeTokens : 0;
  },

  totalTokens: (inputTokens: number | null | undefined, outputTokens: number | null | undefined, cacheRead: number | null | undefined = 0, cacheCreation: number | null | undefined = 0): number => {
    return (inputTokens ?? 0) + (outputTokens ?? 0) + (cacheRead ?? 0) + (cacheCreation ?? 0);
  },

  // Session statistics
  sessionDuration: (firstSeen: string, lastSeen: string): number => {
    return new Date(lastSeen).getTime() - new Date(firstSeen).getTime();
  },

  averageCostPerMessage: (totalCost: number | null | undefined, messageCount: number | null | undefined): number => {
    const safeCost = totalCost ?? 0;
    const safeCount = messageCount ?? 0;
    return safeCount > 0 ? safeCost / safeCount : 0;
  },

  // Token efficiency calculations
  cacheHitRatio: (cacheReadTokens: number | null | undefined, totalTokens: number | null | undefined): number => {
    const safeCacheRead = cacheReadTokens ?? 0;
    const safeTotal = totalTokens ?? 0;
    return safeTotal > 0 ? safeCacheRead / safeTotal : 0;
  },

  inputOutputRatio: (inputTokens: number | null | undefined, outputTokens: number | null | undefined): number => {
    const safeInput = inputTokens ?? 0;
    const safeOutput = outputTokens ?? 0;
    return safeInput > 0 ? safeOutput / safeInput : 0;
  },
};

export const validators = {
  // Data validation helpers
  isValidSession: (session: any): boolean => {
    return session && 
           typeof session.session_id === 'string' && 
           typeof session.total_cost === 'number';
  },

  isValidMessage: (message: any): boolean => {
    return message && 
           typeof message.message_id === 'string' && 
           typeof message.cost === 'number';
  },

  isPositiveNumber: (value: any): boolean => {
    return typeof value === 'number' && value >= 0;
  },
};

export const sorters = {
  // Sorting utilities
  byDate: (a: { timestamp: string }, b: { timestamp: string }, desc = true): number => {
    const dateA = new Date(a.timestamp).getTime();
    const dateB = new Date(b.timestamp).getTime();
    return desc ? dateB - dateA : dateA - dateB;
  },

  byCost: (a: { cost: number }, b: { cost: number }, desc = true): number => {
    return desc ? b.cost - a.cost : a.cost - b.cost;
  },

  byTokens: (a: { input_tokens: number; output_tokens: number }, b: { input_tokens: number; output_tokens: number }, desc = true): number => {
    const totalA = a.input_tokens + a.output_tokens;
    const totalB = b.input_tokens + b.output_tokens;
    return desc ? totalB - totalA : totalA - totalB;
  },
};