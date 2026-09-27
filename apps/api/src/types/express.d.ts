import type { Role } from '../generated/prisma/client.js';
import type { Upload } from '../modules/storage/upload.middleware.js';

// Adds `req.user` (set by requireAuth) and `req.upload` (set by acceptUpload) to Express's Request type.
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        fullName: string;
        role: Role;
      };
      // Set by acceptUpload() once a file passed the type checks
      upload?: Upload;
    }
  }
}

export {};
