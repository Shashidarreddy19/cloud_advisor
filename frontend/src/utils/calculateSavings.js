export const calculateSavings = (current, optimized) => {
    if (!current || !optimized) return 0;
    return current - optimized;
};
