import React from 'react';

const AIAnalysisPanel = ({ aiAnalysis }) => {
    // Debug logging
    console.log('[AIAnalysisPanel] Rendering with data:', aiAnalysis);

    if (!aiAnalysis) {
        console.log('[AIAnalysisPanel] No AI analysis data - not rendering');
        return null;
    }

    console.log('[AIAnalysisPanel] Rendering panel with type:', aiAnalysis.type);

    return (
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mt-4">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
                <span className="text-teal-600 text-lg">✦</span>
                <span className="text-sm font-semibold text-teal-900">AI Analysis</span>
                <span className="ml-auto text-xs font-semibold text-teal-600 bg-teal-100 border border-teal-300 px-2 py-1 rounded-full uppercase tracking-wide">
                    Powered by Gemini
                </span>
            </div>

            {/* Risk Badge - only show if RISKY */}
            {aiAnalysis.verdict === 'RISKY' && aiAnalysis.risk_level && (
                <div className="mb-3">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${aiAnalysis.risk_level === 'HIGH' ? 'bg-red-100 text-red-700' :
                        aiAnalysis.risk_level === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                        }`}>
                        ⚠ {aiAnalysis.risk_level} RISK
                    </span>
                </div>
            )}

            {/* Warnings List - only show if warnings exist */}
            {aiAnalysis.warnings && aiAnalysis.warnings.length > 0 && (
                <div className="mb-3 space-y-1">
                    {aiAnalysis.warnings.map((warning, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm text-yellow-700">
                            <span>⚠</span>
                            <span>{warning}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Message/Explanation */}
            {aiAnalysis.message && (
                <p className="text-sm text-gray-700 leading-relaxed">
                    {aiAnalysis.message}
                </p>
            )}
        </div>
    );
};

export default AIAnalysisPanel;
