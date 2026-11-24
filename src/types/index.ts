export type Phase = 'upload' | 'review' | 'vote' | 'closed' | 'results';
export type Screen = 'home' | 'gallery' | 'upload' | 'my-votes' | 'results' | 'admin';
export type Student = { id: string; name: string; nickname: string };
export type Category = { id: number; title: string; en: string; subtitle: string; color: string };
export type Artwork = { id: string; categoryId: number; ownerId: string; title: string; image: string; createdAt: number; approved: boolean };
export type Votes = Record<number, string[]>;
export type Submission = { studentId: string; votes: Votes; submittedAt: number };
export type DemoData = { phase: Phase; artworks: Artwork[]; students: Student[]; submissions: Submission[]; categories: Category[] };
