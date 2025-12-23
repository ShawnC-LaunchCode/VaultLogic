
import { Router } from "express";
import { documentAIAssistService } from "../lib/ai/DocumentAIAssistService";
import { hybridAuth } from "../middleware/auth";
import multer from "multer";
import { MAX_FILE_SIZE, ALLOWED_FILE_TYPES } from "../services/fileService";

const router = Router();
// SECURITY FIX: Add file size and type validation
const upload = multer({
  storage: multer.memoryStorage(), // Memory storage for parsing
  limits: {
    fileSize: MAX_FILE_SIZE, // 10MB default
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Only allow document types for template analysis
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error(`File type ${file.mimetype} is not allowed. Only PDF and Word documents are supported.`));
    }

    cb(null, true);
  }
});

// Middleware
router.use(hybridAuth);

/**
 * POST /api/ai/template/analyze
 * Upload a file buffer, get analysis (variables + suggestions)
 */
router.post("/analyze", (req, res, next) => {
    // SECURITY FIX: Add multer error handling
    upload.single('file')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({
                    error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`
                });
            }
            if (err.code === 'LIMIT_FILE_COUNT') {
                return res.status(400).json({ error: 'Too many files uploaded' });
            }
            return res.status(400).json({ error: err.message });
        } else if (err) {
            // Custom file filter error
            return res.status(400).json({ error: err.message });
        }

        next();
    });
}, async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file provided" });

        const result = await documentAIAssistService.analyzeTemplate(req.file.buffer, req.file.originalname);
        res.json({ data: result });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Analysis failed" });
    }
});

/**
 * POST /api/ai/template/suggest-mappings
 * Body: { templateVariables: [...], workflowVariables: [...] }
 */
router.post("/suggest-mappings", async (req, res) => {
    try {
        const { templateVariables, workflowVariables } = req.body;
        const mappings = await documentAIAssistService.suggestMappings(templateVariables, workflowVariables);
        res.json({ data: mappings });
    } catch (err) {
        res.status(500).json({ error: "Mapping suggestion failed" });
    }
});

/**
 * POST /api/ai/template/suggest-improvements
 * Body: { variables: [...] }
 * Returns aliases, formatting suggestions
 */
router.post("/suggest-improvements", async (req, res) => {
    try {
        const { variables } = req.body;
        const result = await documentAIAssistService.suggestImprovements(variables);
        res.json({ data: result });
    } catch (err) {
        res.status(500).json({ error: "Improvement suggestion failed" });
    }
});

export default router;
