import path from 'node:path';

/**
 * Where the server and the worker keep files under MEDIA_DIR. Everything lives on one file system so a finished
 * render moves into place with an atomic rename.
 *
 *   inputs/<job id>/photo-<n>.jpg   photos of a queued job (cleaned by the server, deleted once rendered)
 *   videos/<job id>.mp4             finished videos, served by nginx after the server checks ownership
 *   tmp/                            uploads being cleaned and renders in progress
 */
export interface MediaLayout {
  readonly root: string;
  readonly tmp: string;
  readonly videos: string;
  inputDir(jobId: string): string;
  photo(jobId: string, index: number): string;
  video(jobId: string): string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Job ids become file names: anything but a lower-case UUID is refused before it reaches a path. */
function checkedId(jobId: string): string {
  if (!UUID.test(jobId)) throw new Error('invalid job id');
  return jobId;
}

export function mediaLayout(root: string): MediaLayout {
  const abs = path.resolve(root);
  return {
    root: abs,
    tmp: path.join(abs, 'tmp'),
    videos: path.join(abs, 'videos'),
    inputDir: (jobId) => path.join(abs, 'inputs', checkedId(jobId)),
    photo: (jobId, index) => path.join(abs, 'inputs', checkedId(jobId), `photo-${index + 1}.jpg`),
    video: (jobId) => path.join(abs, 'videos', `${checkedId(jobId)}.mp4`),
  };
}

export function isJobId(value: string): boolean {
  return UUID.test(value);
}
