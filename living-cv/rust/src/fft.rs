//! In-place iterative radix-2 FFT. Length must be a power of two.

use core::f32::consts::TAU;

pub fn fft(re: &mut [f32], im: &mut [f32], inverse: bool) {
    let n = re.len();
    debug_assert!(n.is_power_of_two() && im.len() == n);
    // Bit-reversal permutation.
    let mut j = 0;
    for i in 1..n {
        let mut bit = n >> 1;
        while j & bit != 0 {
            j ^= bit;
            bit >>= 1;
        }
        j |= bit;
        if i < j {
            re.swap(i, j);
            im.swap(i, j);
        }
    }
    let sign = if inverse { 1.0 } else { -1.0 };
    let mut len = 2;
    while len <= n {
        let ang = sign * TAU / len as f32;
        let (wr, wi) = (ang.cos(), ang.sin());
        for start in (0..n).step_by(len) {
            let (mut cr, mut ci) = (1.0f32, 0.0f32);
            for k in 0..len / 2 {
                let (a, b) = (start + k, start + k + len / 2);
                let tr = re[b] * cr - im[b] * ci;
                let ti = re[b] * ci + im[b] * cr;
                re[b] = re[a] - tr;
                im[b] = im[a] - ti;
                re[a] += tr;
                im[a] += ti;
                let next = cr * wr - ci * wi;
                ci = cr * wi + ci * wr;
                cr = next;
            }
        }
        len <<= 1;
    }
    if inverse {
        let s = 1.0 / n as f32;
        re.iter_mut().for_each(|v| *v *= s);
        im.iter_mut().for_each(|v| *v *= s);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip() {
        let mut re: Vec<f32> = (0..64).map(|i| (i as f32 * 0.3).sin()).collect();
        let orig = re.clone();
        let mut im = vec![0.0; 64];
        fft(&mut re, &mut im, false);
        fft(&mut re, &mut im, true);
        for (a, b) in re.iter().zip(orig.iter()) {
            assert!((a - b).abs() < 1e-4);
        }
    }

    #[test]
    fn pure_tone_lands_in_its_bin() {
        let n = 256;
        let mut re: Vec<f32> = (0..n)
            .map(|i| (TAU * 8.0 * i as f32 / n as f32).cos())
            .collect();
        let mut im = vec![0.0; n];
        fft(&mut re, &mut im, false);
        let mag: Vec<f32> = (0..n / 2).map(|k| re[k].hypot(im[k])).collect();
        let peak = mag
            .iter()
            .enumerate()
            .max_by(|a, b| a.1.total_cmp(b.1))
            .unwrap()
            .0;
        assert_eq!(peak, 8);
    }
}
