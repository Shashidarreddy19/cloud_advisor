import api from "../../services/api";

export default function BulkResultTable({ results }) {

    const downloadReport = async () => {
        try {
            const res = await api.post(
                '/report/bulk',
                results,
                { responseType: "blob" }
            );

            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", "cloud_optimization_report.pdf");
            document.body.appendChild(link);
            link.click();
        } catch (error) {
            console.error("Error downloading report", error);
        }
    };

    const totalSavings = results.reduce((sum, r) => {
        if (r.current_cost_per_hour && r.recommended_cost_per_hour) {
            return sum + (r.current_cost_per_hour - r.recommended_cost_per_hour);
        }
        return sum;
    }, 0);

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Optimization Results</h3>
                <button
                    onClick={downloadReport}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition shadow-sm"
                >
                    Download PDF Report
                </button>
            </div>

            <div className="mb-6 p-4 bg-green-50 border border-green-100 rounded-xl flex justify-between items-center text-green-800">
                <span className="font-medium">Total Estimated Hourly Savings</span>
                <span className="text-2xl font-bold">${totalSavings.toFixed(3)}</span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="p-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Cloud</th>
                            <th className="p-3 text-xs font-semibold uppercase tracking-wider text-gray-500">VM</th>
                            <th className="p-3 text-xs font-semibold uppercase tracking-wider text-gray-500 text-right">Current Cost</th>
                            <th className="p-3 text-xs font-semibold uppercase tracking-wider text-gray-500 text-right">Rec. Cost</th>
                            <th className="p-3 text-xs font-semibold uppercase tracking-wider text-gray-500 text-center">Class</th>
                            <th className="p-3 text-xs font-semibold uppercase tracking-wider text-green-600 text-right">Savings</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {results.map((r, i) => (
                            <tr key={i} className="hover:bg-gray-50 transition">
                                <td className="p-3 text-sm font-medium text-gray-900 uppercase">{r.cloud}</td>
                                <td className="p-3 text-sm text-gray-600">{r.current_vm}</td>
                                <td className="p-3 text-sm text-gray-600 text-right font-mono">${r.current_cost_per_hour}</td>
                                <td className="p-3 text-sm text-gray-600 text-right font-mono">${r.recommended_cost_per_hour}</td>
                                <td className="p-3 text-center">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${r.final_classification === 'optimal' ? 'bg-green-100 text-green-700' :
                                        r.final_classification === 'oversized' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-red-100 text-red-700'
                                        }`}>
                                        {r.final_classification}
                                    </span>
                                </td>
                                <td className="p-3 text-sm font-bold text-green-600 text-right font-mono">
                                    {r.current_cost_per_hour && r.recommended_cost_per_hour
                                        ? (r.current_cost_per_hour - r.recommended_cost_per_hour).toFixed(3)
                                        : "-"}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}