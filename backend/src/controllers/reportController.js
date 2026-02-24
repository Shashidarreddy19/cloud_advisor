const Report = require('../models/Report');
const User = require('../models/User');

// Get all reports for a user
const getReports = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }

        const reports = await Report.find({ userId: user._id })
            .sort({ generatedAt: -1 });

        // Format for frontend
        const formattedReports = reports.map(report => ({
            id: report._id,
            name: report.name,
            type: report.type,
            status: report.status,
            date: report.generatedAt.toLocaleDateString() + ' ' + report.generatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            size: report.size || `${Math.round(JSON.stringify(report.recommendations).length / 1024)} KB`,
            summary: report.summary,
            recommendationsCount: report.recommendations.length
        }));

        res.json(formattedReports);
    } catch (error) {
        console.error("Get Reports Error:", error);
        res.status(500).json({ error: "Failed to fetch reports" });
    }
};

// Generate/Save a new report
const generateReport = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }

        const { name, recommendations, type } = req.body;

        if (!name || !recommendations || recommendations.length === 0) {
            return res.status(400).json({ error: "Report name and recommendations are required" });
        }

        // Calculate summary
        const totalSavings = recommendations.reduce((sum, r) => sum + (r.savings || 0), 0);
        const oversizedCount = recommendations.filter(r => r.finding === "Oversized").length;
        const undersizedCount = recommendations.filter(r => r.finding === "Undersized").length;
        const optimalCount = recommendations.filter(r => r.finding === "Optimal").length;
        const avgConfidence = recommendations.length > 0
            ? recommendations.reduce((sum, r) => sum + (r.confidence || 0), 0) / recommendations.length
            : 0;

        const report = new Report({
            userId: user._id,
            name,
            type: type || 'CSV',
            recommendations,
            summary: {
                totalRecommendations: recommendations.length,
                totalSavings,
                oversizedCount,
                undersizedCount,
                optimalCount,
                avgConfidence: Math.round(avgConfidence)
            },
            size: `${Math.round(JSON.stringify(recommendations).length / 1024)} KB`
        });

        await report.save();

        console.log(`Report "${name}" generated for user ${user.username}`);

        res.json({
            id: report._id,
            name: report.name,
            type: report.type,
            status: report.status,
            date: report.generatedAt.toLocaleDateString() + ' ' + report.generatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            size: report.size,
            summary: report.summary,
            recommendationsCount: report.recommendations.length
        });
    } catch (error) {
        console.error("Generate Report Error:", error);
        res.status(500).json({ error: "Failed to generate report" });
    }
};

// Get a specific report with full details
const getReportById = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }

        const report = await Report.findOne({
            _id: req.params.id,
            userId: user._id
        });

        if (!report) {
            return res.status(404).json({ error: "Report not found" });
        }

        res.json({
            id: report._id,
            name: report.name,
            type: report.type,
            status: report.status,
            generatedAt: report.generatedAt,
            recommendations: report.recommendations,
            summary: report.summary,
            size: report.size
        });
    } catch (error) {
        console.error("Get Report By ID Error:", error);
        res.status(500).json({ error: "Failed to fetch report" });
    }
};

// Delete a report
const deleteReport = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }

        const report = await Report.findOneAndDelete({
            _id: req.params.id,
            userId: user._id
        });

        if (!report) {
            return res.status(404).json({ error: "Report not found" });
        }

        console.log(`Report "${report.name}" deleted by user ${user.username}`);

        res.json({ message: "Report deleted successfully" });
    } catch (error) {
        console.error("Delete Report Error:", error);
        res.status(500).json({ error: "Failed to delete report" });
    }
};

// Download report as CSV
const downloadReport = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }

        const report = await Report.findOne({
            _id: req.params.id,
            userId: user._id
        });

        if (!report) {
            return res.status(404).json({ error: "Report not found" });
        }

        // Generate CSV content
        const headers = ["Provider", "Resource", "Type", "Region", "Finding", "Current", "Recommended", "CPU %", "Memory %", "Savings", "Confidence"];
        const rows = report.recommendations.map(r => [
            r.cloud || '',
            r.name || '',
            r.resourceType || '',
            r.region || '',
            r.finding || '',
            r.instanceType || '',
            r.recommendedType || '',
            r.cpuUsage || 0,
            r.memUsage || 0,
            r.savings || 0,
            r.confidence || 0
        ]);

        const csv = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${report.name.replace(/[^a-z0-9]/gi, '_')}.csv"`);
        res.send(csv);
    } catch (error) {
        console.error("Download Report Error:", error);
        res.status(500).json({ error: "Failed to download report" });
    }
};

module.exports = {
    getReports,
    generateReport,
    getReportById,
    deleteReport,
    downloadReport
};
