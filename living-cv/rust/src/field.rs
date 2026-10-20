//! The feedback field: verbatims fall, cross a safety membrane, and settle into theme clusters.
//!
//! Positions are closed-form in time and scroll progress, so any frame can be computed directly.
//! Output is a flat buffer of `STRIDE` floats per particle for JavaScript to draw.

use crate::rng::hash;

pub const STRIDE: usize = 4;
pub const THEMES: usize = 5;
const WEIGHTS: [f64; THEMES] = [0.24, 0.18, 0.28, 0.13, 0.17];
const TAU: f64 = core::f64::consts::TAU;

pub mod flag {
    pub const BAD: u32 = 1;
    pub const BELOW: u32 = 2;
}

struct Verbatim {
    x: f64,
    speed: f64,
    phase: f64,
    bad: bool,
    cluster: usize,
    angle: f64,
    radius: f64,
    settle: f64,
}

#[derive(Clone, Copy, Default)]
pub struct Centre {
    pub x: f64,
    pub y: f64,
    pub r: f64,
}

/// Scene geometry and scroll-driven phases for one frame.
pub struct Frame {
    pub t: f64,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    /// Membrane height.
    pub membrane_y: f64,
    /// Membrane strength 0..1.
    pub membrane: f64,
    /// Clustering strength 0..1.
    pub cluster: f64,
}

pub struct Field {
    parts: Vec<Verbatim>,
    pub centres: [Centre; THEMES],
    pub out: Vec<f32>,
}

impl Field {
    pub fn new(n: usize) -> Self {
        let parts = (0..n)
            .map(|i| {
                let fi = i as f64;
                let mut r = hash(fi * 1.91);
                let mut cluster = 0;
                while cluster < THEMES - 1 && r > WEIGHTS[cluster] {
                    r -= WEIGHTS[cluster];
                    cluster += 1;
                }
                Verbatim {
                    x: hash(fi),
                    speed: 0.08 + hash(fi + 0.5) * 0.14,
                    phase: hash(fi * 2.7),
                    bad: hash(fi * 4.3) < 0.14,
                    cluster,
                    angle: hash(fi * 6.1) * TAU,
                    radius: hash(fi * 7.7).sqrt(),
                    settle: hash(fi * 8.9),
                }
            })
            .collect();
        Field { parts, centres: [Centre::default(); THEMES], out: vec![0.0; n * STRIDE] }
    }

    pub fn len(&self) -> usize {
        self.parts.len()
    }

    /// Writes x, y, u (how far it has joined its theme, 0..1) and flags for the first `n` particles.
    pub fn step(&mut self, f: &Frame, n: usize) {
        let n = n.min(self.parts.len());
        for (i, v) in self.parts.iter().take(n).enumerate() {
            let s = (v.phase + f.t * v.speed * 0.5).fract();
            let mut x = f.x + v.x * f.w + (f.t * 0.8 + v.phase * 20.0).sin() * 4.0;
            let mut y = f.y + 40.0 + s * (f.h - 30.0);
            let below = f.membrane > 0.05 && y > f.membrane_y;
            let mut u = 0.0;
            if below && f.cluster > 0.0 {
                let c = self.centres[v.cluster];
                let ang = v.angle + f.t * 0.22 * (1.0 + v.radius);
                let ox = c.x + ang.cos() * v.radius * c.r;
                let oy = c.y + ang.sin() * v.radius * c.r * 0.8;
                u = if v.settle < f.cluster * 0.75 {
                    1.0
                } else {
                    let d = ((y - f.membrane_y) / (f.h * 0.3)).clamp(0.0, 1.0);
                    f.cluster * d * d * (3.0 - 2.0 * d)
                };
                x += (ox - x) * u;
                y += (oy - y) * u;
            }
            let flags = (v.bad as u32) * flag::BAD | (below as u32) * flag::BELOW | (v.cluster as u32) << 2;
            let o = i * STRIDE;
            self.out[o] = x as f32;
            self.out[o + 1] = y as f32;
            self.out[o + 2] = u as f32;
            self.out[o + 3] = flags as f32;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn settled_particles_sit_inside_their_cluster() {
        let mut field = Field::new(400);
        for (i, c) in field.centres.iter_mut().enumerate() {
            *c = Centre { x: 100.0 + i as f64 * 100.0, y: 500.0, r: 30.0 };
        }
        let frame = Frame { t: 3.0, x: 0.0, y: 0.0, w: 600.0, h: 600.0, membrane_y: 200.0, membrane: 1.0, cluster: 1.0 };
        field.step(&frame, 400);
        for i in 0..400 {
            let o = i * STRIDE;
            let flags = field.out[o + 3] as u32;
            if field.out[o + 2] >= 1.0 && flags & flag::BELOW != 0 {
                let c = field.centres[(flags >> 2) as usize];
                let d = ((field.out[o] as f64 - c.x).powi(2) + (field.out[o + 1] as f64 - c.y).powi(2)).sqrt();
                assert!(d <= c.r + 1e-3);
            }
        }
    }
}
