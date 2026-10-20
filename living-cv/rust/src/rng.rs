//! Small deterministic generators: a xorshift RNG and the same `hash` the TypeScript side uses.

/// xorshift64* — fast, seedable, good enough for synthetic signals.
pub struct Rng(u64);

impl Rng {
    pub fn new(seed: u32) -> Self {
        Rng(0x9E37_79B9_7F4A_7C15 ^ (seed as u64).wrapping_mul(0xBF58_476D_1CE4_E5B9) | 1)
    }

    pub fn next_u32(&mut self) -> u32 {
        let mut x = self.0;
        x ^= x >> 12;
        x ^= x << 25;
        x ^= x >> 27;
        self.0 = x;
        (x.wrapping_mul(0x2545_F491_4F6C_DD1D) >> 32) as u32
    }

    /// Uniform in (0, 1).
    pub fn uniform(&mut self) -> f32 {
        (self.next_u32() as f32 + 0.5) / 4_294_967_296.0
    }

    /// Standard normal via Box-Muller.
    pub fn gauss(&mut self) -> f32 {
        let (u1, u2) = (self.uniform(), self.uniform());
        (-2.0 * u1.ln()).sqrt() * (core::f32::consts::TAU * u2).cos()
    }
}

/// Matches `hash` in src/core/math.ts so both backends place particles identically.
pub fn hash(n: f64) -> f64 {
    let s = (n * 127.1 + 311.7).sin() * 43758.5453;
    s - s.floor()
}
