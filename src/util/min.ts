export default function min(values: any) {
  let smallest = Number(Infinity);
  Object.keys(values).forEach((i) => {
    if (values[i] < smallest) {
      smallest = values[i];
    }
  });
  return smallest;
}
