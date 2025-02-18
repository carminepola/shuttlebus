import { Request, Response, NextFunction } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";

// Definisci la cartella di destinazione per i file caricati
const uploadDir = "./uploads/";

// Verifica se la cartella esiste, altrimenti creala
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true }); // Crea la cartella, se non esiste
}

// Configurazione di Multer per il caricamento delle immagini
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: Function) => {
    cb(null, uploadDir); // Salva i file nella cartella 'uploads'
  },
  filename: (req: Request, file: Express.Multer.File, cb: Function) => {
    // Crea un nome univoco per il file basato sul timestamp e sull'estensione
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

// Filtri per accettare solo immagini
const fileFilter = (req: Request, file: Express.Multer.File, cb: Function) => {
  const filetypes = /jpeg|jpg|png|gif/;
  const mimetype = filetypes.test(file.mimetype);
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error("Only image files are allowed."));
};

// Configura Multer con limiti di dimensione e tipo di file
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limite di 5MB per ogni immagine
  fileFilter: fileFilter,
});

// Middleware per il caricamento di una o più immagini
const uploadImagesMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Usa Multer per caricare una o più immagini (campo 'images' nel form)
  req.body.imagePaths = "";

  upload.array("images", 5)(req, res, (err: any) => {
    // Limite massimo di 5 immagini
    if (err) {
      // Gestione errori di caricamento file
      if (err instanceof multer.MulterError) {
        // Errore di Multer (ad esempio, file troppo grande)
        return res.status(400).json({ message: err.message });
      } else if (err.message === "Only image files are allowed.") {
        // Se il tipo di file non è un'immagine
        return res.status(400).json({ message: "Only image files are allowed." });
      }
      // Altri errori generici
      return res.status(500).json({ message: "Server error while uploading images." });
    }

    // Salva i nomi dei file caricati (se ci sono file)
    if (req.files) {
      const fileNames = (req.files as Express.Multer.File[]).map((file) => file.filename);
      req.body.imagePaths = fileNames; // Aggiungi i nomi dei file caricati a req.body
    }

    // Passa al middleware successivo
    next();
  });
};

export default uploadImagesMiddleware;
