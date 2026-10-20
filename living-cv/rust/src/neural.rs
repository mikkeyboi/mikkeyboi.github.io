//! A synthetic intracranial recording and its spectral profile.
//!
//! Each step synthesizes a fresh window: aperiodic 1/f^χ background (white noise shaped in the
//! frequency domain), a bursting beta rhythm whose strength stimulation can suppress, a little
//! alpha, and sparse spikes. It then estimates the power spectrum with Welch's method and fits it
//! the way FOOOF does: a robust aperiodic line in log-log space, then the largest periodic peak
//! above it.

use crate::fft::fft;
use crate::rng::Rng;
use core::f32::consts::TAU;

pub const FS: f32 = 1000.0;
pub const N: usize = 8192;
const SEG: usize = 1024;
const HOP: usize = 512;
pub const BINS: usize = SEG / 2 + 1;
const EXPONENT: f32 = 1.4;
const FIT_LO: f32 = 2.0;
const FIT_HI: f32 = 100.0;
/// Fraction of the flattened spectrum kept as "aperiodic" when refitting.
const ROBUST_KEEP: f32 = 0.4;

/// Fit results, laid out for JavaScript to read as a Float32Array.
#[repr(C)]
#[derive(Default, Clone, Copy)]
pub struct Fit {
    pub offset: f32,
    pub exponent: f32,
    pub peak_hz: f32,
    pub peak_height: f32,
    pub peak_width: f32,
    pub r_squared: f32,
}

pub struct Neural {
    rng: Rng,
    clock: f32,
    pub signal: Vec<f32>,
    pub freqs: Vec<f32>,
    /// log10 power per bin.
    pub power: Vec<f32>,
    /// Fitted aperiodic component, log10 power per bin.
    pub aperiodic: Vec<f32>,
    pub fit: Fit,
    /// Band-limited copies of the signal and their amplitude envelopes, in two slots.
    pub band: [Vec<f32>; 2],
    pub envelope: [Vec<f32>; 2],
    re: Vec<f32>,
    im: Vec<f32>,
}

impl Neural {
    pub fn new(seed: u32) -> Self {
        Neural {
            rng: Rng::new(seed),
            clock: 0.0,
            signal: vec![0.0; N],
            freqs: (0..BINS).map(|k| k as f32 * FS / SEG as f32).collect(),
            power: vec![0.0; BINS],
            aperiodic: vec![0.0; BINS],
            fit: Fit::default(),
            band: [vec![0.0; N], vec![0.0; N]],
            envelope: [vec![0.0; N], vec![0.0; N]],
            re: vec![0.0; N],
            im: vec![0.0; N],
        }
    }

    /// Synthesize a new window and re-fit. `beta_gain` scales the pathological rhythm;
    /// `spike_rate` is spikes per second.
    pub fn step(&mut self, beta_gain: f32, spike_rate: f32) {
        self.synthesize(beta_gain, spike_rate);
        self.welch();
        self.fit_spectrum();
        self.clock += N as f32 / FS;
    }

    /// Band-pass the current window to [lo, hi] Hz and take its amplitude envelope, via the
    /// analytic signal (zero negative frequencies, double positive ones, inverse FFT).
    pub fn band_pass(&mut self, slot: usize, lo: f32, hi: f32) {
        let slot = slot.min(1);
        self.re.copy_from_slice(&self.signal);
        self.im.iter_mut().for_each(|v| *v = 0.0);
        fft(&mut self.re, &mut self.im, false);
        for k in 0..N {
            let f = k as f32 * FS / N as f32;
            let keep = k > 0 && k < N / 2 && f >= lo && f <= hi;
            let g = if keep { 2.0 } else { 0.0 };
            self.re[k] *= g;
            self.im[k] *= g;
        }
        fft(&mut self.re, &mut self.im, true);
        for i in 0..N {
            self.band[slot][i] = self.re[i];
            self.envelope[slot][i] = self.re[i].hypot(self.im[i]);
        }
    }

    fn synthesize(&mut self, beta_gain: f32, spike_rate: f32) {
        // Aperiodic background: white noise shaped to 1/f^χ power.
        for i in 0..N {
            self.re[i] = self.rng.gauss();
            self.im[i] = 0.0;
        }
        fft(&mut self.re, &mut self.im, false);
        for k in 0..N {
            let kk = if k <= N / 2 { k } else { N - k };
            let f = kk as f32 * FS / N as f32;
            let g = if kk == 0 { 0.0 } else { f.powf(-EXPONENT / 2.0) };
            self.re[k] *= g;
            self.im[k] *= g;
        }
        fft(&mut self.re, &mut self.im, true);
        let rms = (self.re.iter().map(|v| v * v).sum::<f32>() / N as f32).sqrt().max(1e-9);

        let phase_b = self.rng.uniform() * TAU;
        let phase_a = self.rng.uniform() * TAU;
        let burst = self.rng.uniform() * TAU;
        for i in 0..N {
            let t = self.clock + i as f32 / FS;
            // Beta waxes and wanes in bursts, as it does in Parkinsonian STN recordings.
            let envelope = 0.55 + 0.45 * (TAU * 0.9 * t + burst).sin();
            let beta = beta_gain * 0.9 * envelope * (TAU * 19.0 * t + phase_b + 0.4 * (TAU * 0.3 * t).sin()).sin();
            let alpha = 0.18 * (TAU * 9.0 * t + phase_a).sin();
            self.signal[i] = self.re[i] / rms + beta + alpha;
        }
        // Sparse biphasic spikes riding on the field potential.
        let expected = spike_rate * N as f32 / FS;
        let count = (expected + self.rng.gauss() * expected.sqrt()).max(0.0) as usize;
        for _ in 0..count {
            let at = (self.rng.uniform() * (N - 4) as f32) as usize;
            let amp = 1.8 + self.rng.uniform() * 1.4;
            self.signal[at] -= amp;
            self.signal[at + 1] += amp * 0.45;
            self.signal[at + 2] += amp * 0.15;
        }
    }

    /// Welch power spectral density: Hann-windowed, half-overlapping segments, averaged.
    fn welch(&mut self) {
        let mut acc = [0.0f32; BINS];
        let mut segments = 0;
        let (re, im) = (&mut self.re[..SEG], &mut self.im[..SEG]);
        let mut start = 0;
        while start + SEG <= N {
            for i in 0..SEG {
                let w = 0.5 - 0.5 * (TAU * i as f32 / (SEG - 1) as f32).cos();
                re[i] = self.signal[start + i] * w;
                im[i] = 0.0;
            }
            fft(re, im, false);
            for k in 0..BINS {
                acc[k] += re[k] * re[k] + im[k] * im[k];
            }
            segments += 1;
            start += HOP;
        }
        let norm = 1.0 / (segments as f32 * FS * SEG as f32 * 0.375);
        for k in 0..BINS {
            self.power[k] = (acc[k] * norm).max(1e-12).log10();
        }
    }

    fn fit_spectrum(&mut self) {
        let idx: Vec<usize> = (0..BINS).filter(|&k| self.freqs[k] >= FIT_LO && self.freqs[k] <= FIT_HI).collect();
        let xs: Vec<f32> = idx.iter().map(|&k| self.freqs[k].log10()).collect();
        let ys: Vec<f32> = idx.iter().map(|&k| self.power[k]).collect();

        // Initial fit on everything, then refit on the points that sit lowest above it,
        // so periodic peaks do not drag the aperiodic line upward.
        let (b0, m0) = line_fit(&xs, &ys, None);
        let flat: Vec<f32> = xs.iter().zip(&ys).map(|(x, y)| (y - (b0 + m0 * x)).max(0.0)).collect();
        let mut sorted = flat.clone();
        sorted.sort_by(|a, b| a.total_cmp(b));
        let thresh = sorted[((sorted.len() as f32 * ROBUST_KEEP) as usize).min(sorted.len() - 1)];
        let mask: Vec<bool> = flat.iter().map(|v| *v <= thresh).collect();
        let (b, m) = line_fit(&xs, &ys, Some(&mask));

        for k in 0..BINS {
            let f = self.freqs[k].max(FIT_LO * 0.5);
            self.aperiodic[k] = b + m * f.log10();
        }

        // The beta-band peak (13–30 Hz) above the aperiodic line, with full width at half maximum.
        let mut best = (0usize, f32::MIN);
        for &k in &idx {
            let f = self.freqs[k];
            if (13.0..=30.0).contains(&f) {
                let h = self.power[k] - self.aperiodic[k];
                if h > best.1 {
                    best = (k, h);
                }
            }
        }
        let (pk, ph) = best;
        let half = ph / 2.0;
        let (mut lo, mut hi) = (pk, pk);
        while lo > 0 && self.power[lo] - self.aperiodic[lo] > half {
            lo -= 1;
        }
        while hi < BINS - 1 && self.power[hi] - self.aperiodic[hi] > half {
            hi += 1;
        }

        let mean = ys.iter().sum::<f32>() / ys.len() as f32;
        let ss_tot: f32 = ys.iter().map(|y| (y - mean).powi(2)).sum();
        let ss_res: f32 = xs.iter().zip(&ys).zip(&mask).filter(|(_, &keep)| keep).map(|((x, y), _)| (y - (b + m * x)).powi(2)).sum();
        self.fit = Fit {
            offset: b,
            exponent: -m,
            peak_hz: self.freqs[pk],
            peak_height: ph.max(0.0),
            peak_width: self.freqs[hi] - self.freqs[lo],
            r_squared: 1.0 - ss_res / ss_tot.max(1e-9),
        };
    }
}

/// Ordinary least squares y = b + m·x over the masked points; returns (b, m).
fn line_fit(xs: &[f32], ys: &[f32], mask: Option<&[bool]>) -> (f32, f32) {
    let (mut n, mut sx, mut sy, mut sxx, mut sxy) = (0.0f32, 0.0, 0.0, 0.0, 0.0);
    for i in 0..xs.len() {
        if mask.map_or(true, |m| m[i]) {
            n += 1.0;
            sx += xs[i];
            sy += ys[i];
            sxx += xs[i] * xs[i];
            sxy += xs[i] * ys[i];
        }
    }
    let m = (n * sxy - sx * sy) / (n * sxx - sx * sx).max(1e-9);
    ((sy - m * sx) / n.max(1.0), m)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recovers_exponent_and_beta_peak() {
        let mut n = Neural::new(7);
        for _ in 0..4 {
            n.step(1.0, 0.0);
        }
        assert!((n.fit.exponent - EXPONENT).abs() < 0.35, "exponent {}", n.fit.exponent);
        assert!((n.fit.peak_hz - 19.0).abs() <= 4.0, "peak at {}", n.fit.peak_hz);
    }

    #[test]
    fn narrow_band_envelope_tracks_beta_better_than_broad() {
        // With beta present, the narrow band around the peak should carry most of the broad band's
        // power while excluding the noise the broad band also collects.
        let mut n = Neural::new(11);
        n.step(1.0, 0.0);
        let (lo, hi) = (n.fit.peak_hz - n.fit.peak_width / 2.0, n.fit.peak_hz + n.fit.peak_width / 2.0);
        n.band_pass(0, 13.0, 30.0);
        n.band_pass(1, lo, hi);
        let energy = |v: &[f32]| v.iter().map(|x| x * x).sum::<f32>();
        let (broad, narrow) = (energy(&n.band[0]), energy(&n.band[1]));
        assert!(narrow < broad && narrow > 0.35 * broad, "narrow {narrow} broad {broad}");
    }

    #[test]
    fn stimulation_shrinks_the_peak() {
        let (mut a, mut b) = (Neural::new(3), Neural::new(3));
        a.step(1.0, 0.0);
        b.step(0.25, 0.0);
        assert!(b.fit.peak_height < a.fit.peak_height);
    }
}
