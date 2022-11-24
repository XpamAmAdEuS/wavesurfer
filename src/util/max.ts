export default function max(values: any) {
  let largest = -Infinity;
  Object.keys(values).forEach((i) => {
    if (values[i] > largest) {
      largest = values[i];
    }
  });
  return largest;
}
