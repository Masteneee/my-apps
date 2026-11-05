// The slider demos that MDX pages can use with <SliderDemo demo="..." />.
// Each demo is plain data plus one pure `compute` function, so:
//  - the same SliderDemo component can show any of them (that's what makes it reusable)
//  - Vitest can check the science without a browser.
// To add a demo: add an entry to DEMOS, then write <SliderDemo demo="yourKey" /> in an .mdx file.

export type DemoResult = {
  text: string; // the sentence shown under the slider
  barFraction: number; // 0 to 1, how full the bar is
  barColor: string; // any CSS colour
};

export type SliderDemoConfig = {
  label: string; // what the slider controls
  unit: string; // shown after the number, e.g. "nm"
  min: number;
  max: number;
  step: number;
  start: number;
  compute: (value: number) => DemoResult;
};

// Rayleigh scattering: scattered intensity is proportional to 1 / wavelength^4.
// We compare to red light at 700 nm so the number is easy to read ("x times more than red").
export const RED_NM = 700;
export function rayleighRelativeToRed(wavelengthNm: number): number {
  return (RED_NM / wavelengthNm) ** 4;
}

// Rough names for visible wavelengths. The borders between colours are fuzzy in reality;
// these are common textbook values.
export function colourName(wavelengthNm: number): string {
  if (wavelengthNm < 450) return 'violet';
  if (wavelengthNm < 495) return 'blue';
  if (wavelengthNm < 570) return 'green';
  if (wavelengthNm < 590) return 'yellow';
  if (wavelengthNm < 620) return 'orange';
  return 'red';
}

// A CSS colour that roughly matches each name, for the bar.
const NAME_TO_CSS: Record<string, string> = {
  violet: '#8b5cf6',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  red: '#ef4444',
};

const RAYLEIGH_MIN_NM = 380;

export const DEMOS = {
  rayleigh: {
    label: 'Wavelength of the light',
    unit: 'nm',
    min: RAYLEIGH_MIN_NM,
    max: 700,
    step: 5,
    start: 450,
    compute(wavelengthNm: number): DemoResult {
      const ratio = rayleighRelativeToRed(wavelengthNm);
      const name = colourName(wavelengthNm);
      return {
        text: `${wavelengthNm} nm (${name}) is scattered ${ratio.toFixed(1)} times as much as red light at ${RED_NM} nm.`,
        // The shortest wavelength on the slider scatters the most, so it fills the bar.
        barFraction: ratio / rayleighRelativeToRed(RAYLEIGH_MIN_NM),
        barColor: NAME_TO_CSS[name],
      };
    },
  },
} satisfies Record<string, SliderDemoConfig>;

export type DemoName = keyof typeof DEMOS;
