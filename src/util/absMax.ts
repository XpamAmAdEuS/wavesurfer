import utilMax from './max';
import utilmin from './min';

export default function absMax(values: any[]) {
  const max = utilMax(values);
  const min = utilmin(values);
  return -min > max ? -min : max;
}
