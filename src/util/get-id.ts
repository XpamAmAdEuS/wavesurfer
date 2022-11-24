export default function getId(prefix: any) {
  if (prefix === undefined) {
    prefix = 'wavesurfer_';
  }
  return prefix + Math.random().toString(32).substring(2);
}
