// Intentionally disabled.
// This used to rewrite git history and delete every *.jpg from every commit.
// Item photos are now those JPEG files, so running the old script would
// wipe the current images out of the repository.
//
// To shrink history, replace main with a fresh root commit of the current
// tree, then force-push. Do not strip *.jpg from history.

console.error('Refusing to run: this script would delete current JPEG images from git history.');
console.error('Photos now live as public/images/*.jpg (plus item-N.jpg thumbnails).');
console.error('If the repo is still large, squash to a new root commit instead of filtering out JPEGs.');
process.exit(1);
