// Canonical UNEB / UACE syllabus outline for Physics and Mathematics.
//
// This is the single source of truth for the app's subject structure. Everything
// else (topic lists, search index, admin pickers, the /syllabus page) derives
// from here so the tree can never drift out of sync with itself.
//
// Shape:
//
//   subject -> chapters[] -> topics[] -> subtopics[]
//
// ── The alias system ───────────────────────────────────────────────────────
// Content in this app predates this tree and tags itself with free-text topic
// strings that do not match the official outline: 'Energy & Power', 'Gas Laws',
// 'Calculus Applications', 'Electricity & Circuits', 'Waves & Sound', and so
// on. Every chapter, topic and subtopic may therefore carry an `aliases` array
// listing the legacy strings that should resolve to it.
//
// Without these, a scenario that tags itself 'Fluid Mechanics' would never
// register against the Fluid Mechanics subtopic and that row of the outline
// would stay permanently empty. `resolveTopicRef()` is the bridge.
//
// Matching is case-insensitive and whitespace-tolerant.

export const SYLLABUS = {
  physics: {
    id: 'physics',
    name: 'Physics',
    icon: 'solar:atom-bold',
    color: 'from-blue-500 to-cyan-500',
    accent: 'blue',
    description: 'Mechanics, thermal physics, waves, electricity, optics and modern physics.',
    chapters: [
      // ── 1. Mechanics ──────────────────────────────────────────────────────
      {
        id: 'phy-mechanics',
        name: 'Mechanics',
        icon: 'solar:compass-2-linear',
        aliases: ['Classical Mechanics', 'Mechanics'],
        topics: [
          {
            id: 'phy-mech-equilibrium',
            name: 'Forces and Equilibrium',
            difficulty: 'Intermediate',
            aliases: ['Statics'],
            subtopics: [
              { id: 'phy-mech-equilibrium-laws', name: "Newton's three laws" },
              { id: 'phy-mech-equilibrium-fbd', name: 'Free-body diagrams and resultant force' },
              { id: 'phy-mech-equilibrium-moments', name: 'Moments, couples and conditions of equilibrium' },
              { id: 'phy-mech-equilibrium-cog', name: 'Centre of gravity' },
              { id: 'phy-mech-equilibrium-machines', name: 'Simple machines and mechanical advantage' },
              { id: 'phy-mech-equilibrium-friction', name: 'Friction and its molecular basis' },
            ],
          },
          {
            id: 'phy-mech-energy',
            name: 'Work, Energy and Power',
            difficulty: 'Intermediate',
            aliases: ['Energy & Power', 'Work, Energy & Power'],
            subtopics: [
              { id: 'phy-mech-energy-work', name: 'Work done by a constant force' },
              { id: 'phy-mech-energy-kinetic', name: 'Kinetic and potential energy' },
              { id: 'phy-mech-energy-conservation', name: 'Conservation of energy' },
              { id: 'phy-mech-energy-power', name: 'Power and efficiency' },
            ],
          },
          {
            id: 'phy-mech-circular',
            name: 'Circular Motion',
            difficulty: 'Advanced',
            aliases: ['Circular Motion'],
            subtopics: [
              { id: 'phy-mech-circular-ucm', name: 'Uniform circular motion and centripetal acceleration' },
              { id: 'phy-mech-circular-banking', name: 'Banking of curves' },
              { id: 'phy-mech-circular-vertical', name: 'Motion in a vertical circle' },
            ],
          },
          {
            id: 'phy-mech-gravitation',
            name: 'Gravitation',
            difficulty: 'Advanced',
            aliases: ['Gravitation'],
            subtopics: [
              { id: 'phy-mech-gravitation-law', name: 'Universal law of gravitation' },
              { id: 'phy-mech-gravitation-orbits', name: 'Motion of satellites and orbits' },
              { id: 'phy-mech-gravitation-field', name: 'Gravitational field strength and potential' },
            ],
          },
          {
            id: 'phy-mech-momentum',
            name: 'Momentum and Collisions',
            difficulty: 'Advanced',
            aliases: ['Linear Momentum'],
            subtopics: [
              { id: 'phy-mech-momentum-conservation', name: 'Linear momentum and its conservation' },
              { id: 'phy-mech-momentum-impulse', name: 'Impulse and the impulse-momentum relation' },
              { id: 'phy-mech-momentum-collisions', name: 'Elastic and inelastic collisions' },
            ],
          },
          {
            id: 'phy-mech-shm',
            name: 'Oscillations and SHM',
            difficulty: 'Advanced',
            aliases: ['Simple Harmonic Motion', 'SHM'],
            subtopics: [
              { id: 'phy-mech-shm-definition', name: 'Definition and characteristics of SHM' },
              { id: 'phy-mech-shm-pendulum', name: 'The simple pendulum' },
              { id: 'phy-mech-shm-energy', name: 'Energy in SHM' },
            ],
          },
          {
            id: 'phy-mech-rotational',
            name: 'Rotational Dynamics',
            difficulty: 'Advanced',
            aliases: ['Rotation'],
            subtopics: [
              { id: 'phy-mech-rotational-angular', name: 'Angular speed and angular acceleration' },
              { id: 'phy-mech-rotational-inertia', name: 'Moment of inertia' },
              { id: 'phy-mech-rotational-energy', name: 'Rotational kinetic energy' },
              { id: 'phy-mech-rotational-angular-momentum', name: 'Angular momentum and its conservation' },
            ],
          },
          {
            id: 'phy-mech-elasticity',
            name: 'Elasticity',
            difficulty: 'Intermediate',
            aliases: ['Elasticity'],
            subtopics: [
              { id: 'phy-mech-elasticity-stress', name: 'Stress, strain and the elastic modulus' },
              { id: 'phy-mech-elasticity-hooke', name: "Hooke's law and the elastic limit" },
            ],
          },
          {
            id: 'phy-mech-fluids',
            name: 'Fluid Mechanics',
            difficulty: 'Advanced',
            aliases: ['Fluid Mechanics'],
            subtopics: [
              { id: 'phy-mech-fluids-density', name: 'Density and relative density' },
              { id: 'phy-mech-fluids-pressure', name: "Pressure in fluids and Pascal's principle" },
              { id: 'phy-mech-fluids-archimedes', name: "Archimedes' principle and upthrust" },
              { id: 'phy-mech-fluids-viscosity', name: 'Viscosity and terminal velocity' },
              { id: 'phy-mech-fluids-surface-tension', name: 'Surface tension' },
            ],
          },
        ],
      },

      // ── 2. Waves & Oscillations ───────────────────────────────────────────
      {
        id: 'phy-waves',
        name: 'Waves & Oscillations',
        icon: 'solar:graph-up-linear',
        aliases: ['Waves', 'Oscillations'],
        topics: [
          {
            id: 'phy-waves-motion',
            name: 'Wave Motion',
            difficulty: 'Intermediate',
            subtopics: [
              { id: 'phy-waves-motion-types', name: 'Transverse and longitudinal waves' },
              { id: 'phy-waves-motion-speed', name: 'Wave speed, frequency and wavelength' },
              { id: 'phy-waves-motion-superposition', name: 'Superposition, reflection and refraction of waves' },
              { id: 'phy-waves-motion-beats', name: 'Beats' },
            ],
          },
          {
            id: 'phy-waves-stationary',
            name: 'Stationary Waves',
            difficulty: 'Advanced',
            subtopics: [
              { id: 'phy-waves-stationary-nodes', name: 'Nodes and antinodes' },
              { id: 'phy-waves-stationary-harmonics', name: 'Harmonics and overtones' },
              { id: 'phy-waves-stationary-resonance', name: 'Resonance' },
            ],
          },
          {
            id: 'phy-waves-sound',
            name: 'Sound',
            difficulty: 'Intermediate',
            aliases: ['Waves & Sound', 'Sound Waves'],
            subtopics: [
              { id: 'phy-waves-sound-speed', name: 'Speed of sound and its dependence on temperature' },
              { id: 'phy-waves-sound-pipes', name: 'Open and closed pipes' },
              { id: 'phy-waves-sound-quality', name: 'Quality, pitch and loudness' },
              { id: 'phy-waves-sound-ultrasound', name: 'Ultrasound and its applications' },
            ],
          },
          {
            id: 'phy-waves-doppler',
            name: 'Doppler Effect',
            difficulty: 'Advanced',
            subtopics: [
              { id: 'phy-waves-doppler-effect', name: 'Doppler shift and its calculation' },
            ],
          },
          {
            id: 'phy-waves-optics',
            name: 'Wave Optics',
            difficulty: 'Advanced',
            aliases: ['Wave Optics', 'Interference & Diffraction'],
            subtopics: [
              { id: 'phy-waves-optics-diffraction', name: 'Diffraction of light' },
              { id: 'phy-waves-optics-interference', name: "Interference and Young's double slits" },
              { id: 'phy-waves-optics-polarisation', name: 'Polarisation of light' },
            ],
          },
        ],
      },

      // ── 3. Thermal Physics ────────────────────────────────────────────────
      {
        id: 'phy-thermal',
        name: 'Thermal Physics',
        icon: 'solar:fire-linear',
        aliases: ['Thermal Physics'],
        topics: [
          {
            id: 'phy-thermal-measurement',
            name: 'Temperature Measurement',
            difficulty: 'Beginner',
            subtopics: [
              { id: 'phy-thermal-measurement-scales', name: 'Temperature scales and their conversion' },
              { id: 'phy-thermal-measurement-thermometers', name: 'Thermometers and calibration' },
              { id: 'phy-thermal-measurement-expansion', name: 'Thermal expansion' },
            ],
          },
          {
            id: 'phy-thermal-heat',
            name: 'Heat and Specific Heat Capacity',
            difficulty: 'Intermediate',
            aliases: ['Heat Transfer'],
            subtopics: [
              { id: 'phy-thermal-heat-definition', name: 'Specific heat capacity' },
              { id: 'phy-thermal-heat-measurement', name: 'Methods of measuring specific heat capacity' },
            ],
          },
          {
            id: 'phy-thermal-calorimetry',
            name: 'Latent Heat and Calorimetry',
            difficulty: 'Intermediate',
            aliases: ['Calorimetry'],
            subtopics: [
              { id: 'phy-thermal-calorimetry-latent', name: 'Latent heat of fusion and vaporisation' },
              { id: 'phy-thermal-calorimetry-mixtures', name: 'The method of mixtures' },
            ],
          },
          {
            id: 'phy-thermal-kinetic',
            name: 'Kinetic Theory of Gases',
            difficulty: 'Advanced',
            subtopics: [
              { id: 'phy-thermal-kinetic-assumptions', name: 'Assumptions of the kinetic theory' },
              { id: 'phy-thermal-kinetic-equation', name: 'Equation of state and molecular interpretation' },
              { id: 'phy-thermal-kinetic-dalton', name: "Dalton's law of partial pressures" },
            ],
          },
          {
            id: 'phy-thermal-gas-laws',
            name: 'Gas Laws',
            difficulty: 'Intermediate',
            aliases: ['Gas Laws'],
            subtopics: [
              { id: 'phy-thermal-gas-laws-boyle', name: "Boyle's law" },
              { id: 'phy-thermal-gas-laws-charles', name: "Charles's law" },
              { id: 'phy-thermal-gas-laws-pressure', name: 'Pressure law' },
              { id: 'phy-thermal-gas-laws-combined', name: 'Combined gas equation' },
            ],
          },
          {
            id: 'phy-thermal-radiation',
            name: 'Radiation and Thermal Emission',
            difficulty: 'Advanced',
            subtopics: [
              { id: 'phy-thermal-radiation-blackbody', name: 'Black body radiation' },
              { id: 'phy-thermal-radiation-stefan', name: "Stefan-Boltzmann and Wien's laws" },
              { id: 'phy-thermal-radiation-greenhouse', name: 'The greenhouse effect and global warming' },
            ],
          },
        ],
      },

      // ── 4. Electricity & Magnetism ────────────────────────────────────────
      {
        id: 'phy-em',
        name: 'Electricity & Magnetism',
        icon: 'solar:lightning-linear',
        aliases: ['Electricity & Magnetism', 'Electricity'],
        topics: [
          {
            id: 'phy-em-electrostatics',
            name: 'Electrostatics',
            difficulty: 'Intermediate',
            aliases: ['Electricity & Circuits', 'Static Electricity'],
            subtopics: [
              { id: 'phy-em-electrostatics-coulomb', name: "Coulomb's law" },
              { id: 'phy-em-electrostatics-field', name: 'Electric field and field lines' },
              { id: 'phy-em-electrostatics-strength', name: 'Electric field strength' },
            ],
          },
          {
            id: 'phy-em-current',
            name: 'Current Electricity',
            difficulty: 'Intermediate',
            aliases: ['Electricity & Circuits', 'Electric Current'],
            subtopics: [
              { id: 'phy-em-current-direction', name: 'Conventional current and electron flow' },
              { id: 'phy-em-current-ohms', name: "Ohm's law and resistivity" },
              { id: 'phy-em-current-characteristics', name: 'I-V characteristics of conductors and filament lamps' },
            ],
          },
          {
            id: 'phy-em-circuits',
            name: 'Circuit Analysis',
            difficulty: 'Intermediate',
            aliases: ['Electricity & Circuits', 'Circuits'],
            subtopics: [
              { id: 'phy-em-circuits-divider', name: 'Potential divider' },
              { id: 'phy-em-circuits-combinations', name: 'Series and parallel combinations' },
              { id: 'phy-em-circuits-emf', name: 'EMF and internal resistance' },
            ],
          },
          {
            id: 'phy-em-power',
            name: 'Electrical Power and Energy',
            difficulty: 'Beginner',
            subtopics: [
              { id: 'phy-em-power-dissipation', name: 'Power dissipated, P = VI' },
              { id: 'phy-em-power-energy', name: 'Energy consumed in kWh' },
            ],
          },
          {
            id: 'phy-em-magnetism',
            name: 'Magnetism',
            difficulty: 'Intermediate',
            aliases: ['Magnetic Effects'],
            subtopics: [
              { id: 'phy-em-magnetism-fields', name: 'Magnetic field patterns' },
              { id: 'phy-em-magnetism-force', name: 'Force on a current-carrying conductor' },
              { id: 'phy-em-magnetism-motor', name: 'The motor effect' },
            ],
          },
          {
            id: 'phy-em-induction',
            name: 'Electromagnetic Induction',
            difficulty: 'Advanced',
            aliases: ['Electromagnetic Induction & AC'],
            subtopics: [
              { id: 'phy-em-induction-faraday', name: "Faraday's law" },
              { id: 'phy-em-induction-lenz', name: "Lenz's law" },
              { id: 'phy-em-induction-inductance', name: 'Mutual and self inductance' },
            ],
          },
          {
            id: 'phy-em-ac',
            name: 'Alternating Current',
            difficulty: 'Advanced',
            aliases: ['AC'],
            subtopics: [
              { id: 'phy-em-ac-circuits', name: 'AC circuits and reactance' },
              { id: 'phy-em-ac-transformers', name: 'Transformers' },
            ],
          },
        ],
      },

      // ── 5. Optics ─────────────────────────────────────────────────────────
      {
        id: 'phy-optics',
        name: 'Optics',
        icon: 'solar:eye-linear',
        aliases: ['Light'],
        topics: [
          {
            id: 'phy-optics-refraction',
            name: 'Reflection and Refraction',
            difficulty: 'Intermediate',
            subtopics: [
              { id: 'phy-optics-refraction-reflection', name: 'Laws of reflection' },
              { id: 'phy-optics-refraction-snell', name: "Snell's law of refraction" },
              { id: 'phy-optics-refraction-tir', name: 'Total internal reflection and the critical angle' },
            ],
          },
          {
            id: 'phy-optics-mirrors',
            name: 'Spherical Mirrors',
            difficulty: 'Intermediate',
            aliases: ['Mirrors'],
            subtopics: [
              { id: 'phy-optics-mirrors-formula', name: 'Mirror formula and linear magnification' },
              { id: 'phy-optics-mirrors-images', name: 'Real and virtual images' },
            ],
          },
          {
            id: 'phy-optics-lenses',
            name: 'Lenses',
            difficulty: 'Intermediate',
            aliases: ['Lenses'],
            subtopics: [
              { id: 'phy-optics-lenses-formula', name: 'Lens formula and power of a lens' },
              { id: 'phy-optics-lenses-combination', name: 'Combination of thin lenses' },
            ],
          },
          {
            id: 'phy-optics-instruments',
            name: 'Optical Instruments',
            difficulty: 'Intermediate',
            aliases: ['Optical Instruments'],
            subtopics: [
              { id: 'phy-optics-instruments-eye', name: 'The eye and defects of vision' },
              { id: 'phy-optics-instruments-magnifier', name: 'Simple magnifying glass' },
              { id: 'phy-optics-instruments-microscope', name: 'Microscope and telescope' },
            ],
          },
          {
            id: 'phy-optics-interference',
            name: 'Interference and Diffraction',
            difficulty: 'Advanced',
            aliases: ['Interference & Diffraction'],
            subtopics: [
              { id: 'phy-optics-interference-double-slit', name: "Young's double-slit experiment" },
              { id: 'phy-optics-interference-grating', name: 'Diffraction gratings' },
            ],
          },
        ],
      },

      // ── 6. Modern Physics ─────────────────────────────────────────────────
      {
        id: 'phy-modern',
        name: 'Modern Physics',
        icon: 'solar:atom-italic',
        aliases: ['Modern Physics', 'Quantum Physics'],
        topics: [
          {
            id: 'phy-modern-atomic',
            name: 'Atomic Structure',
            difficulty: 'Intermediate',
            aliases: ['Atomic Structure'],
            subtopics: [
              { id: 'phy-modern-atomic-rutherford', name: "Rutherford's model of the atom" },
              { id: 'phy-modern-atomic-levels', name: 'Electron energy levels and spectra' },
              { id: 'phy-modern-atomic-bohr', name: "Bohr's hydrogen atom" },
            ],
          },
          {
            id: 'phy-modern-nuclear',
            name: 'Nuclear Physics and Radioactivity',
            difficulty: 'Advanced',
            aliases: ['Nuclear Physics', 'Radioactivity'],
            subtopics: [
              { id: 'phy-modern-nuclear-decay', name: 'Radioactive decay, half-life and decay constant' },
              { id: 'phy-modern-nuclear-radiation', name: 'Alpha, beta and gamma radiation' },
              { id: 'phy-modern-nuclear-reactions', name: 'Nuclear equations, fission and fusion' },
            ],
          },
          {
            id: 'phy-modern-photoelectric',
            name: 'Photoelectric Effect',
            difficulty: 'Advanced',
            subtopics: [
              { id: 'phy-modern-photoelectric-equation', name: "Einstein's photoelectric equation" },
              { id: 'phy-modern-photoelectric-threshold', name: 'Threshold frequency and work function' },
            ],
          },
          {
            id: 'phy-modern-duality',
            name: 'Wave-Particle Duality',
            difficulty: 'Advanced',
            subtopics: [
              { id: 'phy-modern-duality-debroglie', name: 'de Broglie wavelength' },
              { id: 'phy-modern-duality-diffraction', name: 'Electron diffraction' },
            ],
          },
          {
            id: 'phy-modern-quantum',
            name: 'Quantum Mechanics',
            difficulty: 'Advanced',
            aliases: ['Quantum Mechanics'],
            subtopics: [
              { id: 'phy-modern-quantum-quantisation', name: "Energy quantisation and Planck's hypothesis" },
              { id: 'phy-modern-quantum-uncertainty', name: 'The uncertainty principle' },
            ],
          },
          {
            id: 'phy-modern-relativity',
            name: 'Relativity',
            difficulty: 'Advanced',
            aliases: ['Relativity'],
            subtopics: [
              { id: 'phy-modern-relativity-postulates', name: 'Postulates of special relativity' },
              { id: 'phy-modern-relativity-dilation', name: 'Time dilation and length contraction' },
            ],
          },
          {
            id: 'phy-modern-electronics',
            name: 'Electronics and Semiconductors',
            difficulty: 'Advanced',
            aliases: ['Semiconductors', 'Physical Electronics'],
            subtopics: [
              { id: 'phy-modern-electronics-doping', name: 'Doping and the p-n junction' },
              { id: 'phy-modern-electronics-transistor', name: 'Transistor action' },
            ],
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // MATHEMATICS
  // ═══════════════════════════════════════════════════════════════════════
  mathematics: {
    id: 'mathematics',
    name: 'Mathematics',
    icon: 'solar:calculator-bold',
    color: 'from-rose-500 to-pink-500',
    accent: 'rose',
    description: 'Pure mathematics, calculus, coordinate geometry, trigonometry, statistics and mechanics.',
    // "Applied Mathematics" is the name of the UNEB paper (Paper 2), not of any
    // single chapter — it spans mechanics, statistics and numerical methods.
    // Resolving it at subject level keeps those questions counted rather than
    // dropped, without crediting them to an arbitrary chapter.
    subjectAliases: ['Applied Mathematics', 'Applied Maths'],
    chapters: [
      // ── 1. Pure Mathematics ───────────────────────────────────────────────
      {
        id: 'mat-pure',
        name: 'Pure Mathematics',
        icon: 'solar:function-linear',
        aliases: ['Pure Mathematics'],
        topics: [
          {
            id: 'mat-pure-algebra',
            name: 'Algebra and Inequalities',
            difficulty: 'Beginner',
            subtopics: [
              { id: 'mat-pure-algebra-indices', name: 'Indices and surds' },
              { id: 'mat-pure-algebra-logarithms', name: 'Logarithms' },
              { id: 'mat-pure-algebra-quadratics', name: 'Quadratic equations and the discriminant' },
              { id: 'mat-pure-algebra-inequalities', name: 'Inequalities' },
            ],
          },
          {
            id: 'mat-pure-sequences',
            name: 'Sequences and Series',
            difficulty: 'Intermediate',
            aliases: ['Sequences & Series', 'Progressions'],
            subtopics: [
              { id: 'mat-pure-sequences-ap', name: 'Arithmetic progressions' },
              { id: 'mat-pure-sequences-gp', name: 'Geometric progressions' },
              { id: 'mat-pure-sequences-infinity', name: 'Sum to infinity' },
            ],
          },
          {
            id: 'mat-pure-binomial',
            name: 'Binomial Theorem',
            difficulty: 'Intermediate',
            aliases: ['Binomial Expansion'],
            subtopics: [
              { id: 'mat-pure-binomial-expansion', name: 'Expansion of (a + b)ⁿ' },
              { id: 'mat-pure-binomial-coefficients', name: 'Binomial coefficients and combinations' },
            ],
          },
          {
            id: 'mat-pure-polynomials',
            name: 'Polynomials and Roots',
            difficulty: 'Intermediate',
            subtopics: [
              { id: 'mat-pure-polynomials-theorems', name: 'Remainder and factor theorems' },
              { id: 'mat-pure-polynomials-vieta', name: "Vieta's formulae" },
            ],
          },
          {
            id: 'mat-pure-complex',
            name: 'Complex Numbers',
            difficulty: 'Advanced',
            aliases: ['Complex Numbers'],
            subtopics: [
              { id: 'mat-pure-complex-modulus', name: 'Modulus and argument' },
              { id: 'mat-pure-complex-conjugate', name: 'Conjugate and product with conjugate' },
              { id: 'mat-pure-complex-demoivre', name: "De Moivre's theorem" },
              { id: 'mat-pure-complex-roots', name: 'Solving quadratic equations with complex roots' },
            ],
          },
          {
            id: 'mat-pure-induction',
            name: 'Proof by Induction',
            difficulty: 'Advanced',
            aliases: ['Proof by Induction', 'Mathematical Induction'],
            subtopics: [
              { id: 'mat-pure-induction-method', name: 'Mathematical induction' },
            ],
          },
          {
            id: 'mat-pure-functions',
            name: 'Functions and Graphs',
            difficulty: 'Intermediate',
            aliases: ['Functions'],
            subtopics: [
              { id: 'mat-pure-functions-domain', name: 'Domain and range' },
              { id: 'mat-pure-functions-composite', name: 'Composite and inverse functions' },
              { id: 'mat-pure-functions-transformations', name: 'Transformations of graphs' },
            ],
          },
        ],
      },

      // ── 2. Calculus ───────────────────────────────────────────────────────
      {
        id: 'mat-calc',
        name: 'Calculus',
        icon: 'solar:graph-2-linear',
        aliases: ['Calculus', 'Calculus Applications'],
        topics: [
          {
            id: 'mat-calc-differentiation',
            name: 'Differentiation',
            difficulty: 'Intermediate',
            aliases: ['Differentiation'],
            subtopics: [
              { id: 'mat-calc-differentiation-rules', name: 'Power, product and quotient rules' },
              { id: 'mat-calc-differentiation-chain', name: 'Chain rule' },
              { id: 'mat-calc-differentiation-implicit', name: 'Implicit and parametric differentiation' },
              { id: 'mat-calc-differentiation-partial', name: 'Partial derivatives' },
            ],
          },
          {
            id: 'mat-calc-diff-applications',
            name: 'Applications of Differentiation',
            difficulty: 'Advanced',
            aliases: ['Optimization', 'Applications of Derivatives'],
            subtopics: [
              { id: 'mat-calc-diff-applications-stationary', name: 'Stationary points and turning points' },
              { id: 'mat-calc-diff-applications-sketching', name: 'Curve sketching' },
              { id: 'mat-calc-diff-applications-rates', name: 'Rates of change' },
              { id: 'mat-calc-diff-applications-small-angle', name: 'Small angle approximations and related rates' },
            ],
          },
          {
            id: 'mat-calc-integration',
            name: 'Integration',
            difficulty: 'Intermediate',
            aliases: ['Integration'],
            subtopics: [
              { id: 'mat-calc-integration-standard', name: 'Standard integrals' },
              { id: 'mat-calc-integration-substitution', name: 'Integration by substitution' },
              { id: 'mat-calc-integration-parts', name: 'Integration by parts' },
              { id: 'mat-calc-integration-definite', name: 'Definite integrals and areas' },
            ],
          },
          {
            id: 'mat-calc-numerical-integration',
            name: 'Numerical Integration',
            difficulty: 'Advanced',
            aliases: ['Trapezium Rule', 'Simpson’s Rule'],
            subtopics: [
              { id: 'mat-calc-numerical-integration-trapezium', name: 'Trapezium rule' },
              { id: 'mat-calc-numerical-integration-simpsons', name: "Simpson's rule" },
            ],
          },
          {
            id: 'mat-calc-differential-equations',
            name: 'Differential Equations',
            difficulty: 'Advanced',
            aliases: ['Differential Equations'],
            subtopics: [
              { id: 'mat-calc-differential-equations-separation', name: 'Separation of variables' },
              { id: 'mat-calc-differential-equations-linear', name: 'First order linear equations' },
            ],
          },
        ],
      },

      // ── 3. Coordinate Geometry ────────────────────────────────────────────
      {
        id: 'mat-coord',
        name: 'Coordinate Geometry',
        icon: 'solar:axis-vertical-linear',
        aliases: ['Coordinate Geometry', 'Analytical Geometry'],
        topics: [
          {
            id: 'mat-coord-lines',
            name: 'Straight Lines',
            difficulty: 'Intermediate',
            aliases: ['Straight Lines'],
            subtopics: [
              { id: 'mat-coord-lines-gradient', name: 'Gradient and equation of a line' },
              { id: 'mat-coord-lines-distance', name: 'Distance and section formulae' },
              { id: 'mat-coord-lines-angle', name: 'Angle between two lines' },
            ],
          },
          {
            id: 'mat-coord-circles',
            name: 'Circles',
            difficulty: 'Intermediate',
            aliases: ['Circles'],
            subtopics: [
              { id: 'mat-coord-circles-equation', name: 'General and Cartesian equation of a circle' },
              { id: 'mat-coord-circles-intersection', name: 'Circle and line intersection' },
            ],
          },
          {
            id: 'mat-coord-conics',
            name: 'Conics',
            difficulty: 'Advanced',
            aliases: ['Ellipse', 'Hyperbola', 'Ellipses & Hyperbolas'],
            subtopics: [
              { id: 'mat-coord-conics-ellipse', name: 'Standard form of an ellipse' },
              { id: 'mat-coord-conics-hyperbola', name: 'Standard form of a hyperbola' },
            ],
          },
          {
            id: 'mat-coord-loci',
            name: 'Loci',
            difficulty: 'Advanced',
            aliases: ['Locus'],
            subtopics: [
              { id: 'mat-coord-loci-condition', name: 'Locus from a geometric condition' },
            ],
          },
          {
            id: 'mat-coord-3d',
            name: 'Three-dimensional Co-ordinate Geometry',
            difficulty: 'Advanced',
            aliases: ['3D Co-ordinate Geometry'],
            subtopics: [
              { id: 'mat-coord-3d-systems', name: 'Co-ordinate systems in three dimensions' },
              { id: 'mat-coord-3d-line-plane', name: 'Equation of a line and a plane in 3D' },
            ],
          },
        ],
      },

      // ── 4. Trigonometry ───────────────────────────────────────────────────
      {
        id: 'mat-trig',
        name: 'Trigonometry',
        icon: 'solar:angle-linear',
        aliases: ['Trigonometry'],
        topics: [
          {
            id: 'mat-trig-identities',
            name: 'Identities and Equations',
            difficulty: 'Intermediate',
            aliases: ['Trigonometric Identities'],
            subtopics: [
              { id: 'mat-trig-identities-compound', name: 'Compound-angle formulae' },
              { id: 'mat-trig-identities-proofs', name: 'Proof of identities' },
              { id: 'mat-trig-identities-equations', name: 'Solution of trigonometric equations' },
            ],
          },
          {
            id: 'mat-trig-triangles',
            name: 'Solution of Triangles',
            difficulty: 'Advanced',
            aliases: ['Solution of Triangles', 'Heights and Angles'],
            subtopics: [
              { id: 'mat-trig-triangles-sine', name: 'Sine rule' },
              { id: 'mat-trig-triangles-cosine', name: 'Cosine rule' },
              { id: 'mat-trig-triangles-area', name: 'Area of a triangle' },
              { id: 'mat-trig-triangles-heights', name: 'Angles of elevation and depression' },
              { id: 'mat-trig-triangles-3d', name: 'Three-dimensional problems' },
            ],
          },
        ],
      },

      // ── 5. Vectors and Matrices ───────────────────────────────────────────
      {
        id: 'mat-vectors',
        name: 'Vectors and Matrices',
        icon: 'solar:layers-linear',
        aliases: ['Vectors', 'Matrices', 'Vector Algebra', 'Linear Algebra'],
        topics: [
          {
            id: 'mat-vectors-algebra',
            name: 'Vector Algebra',
            difficulty: 'Intermediate',
            aliases: ['Vector Algebra'],
            subtopics: [
              { id: 'mat-vectors-algebra-components', name: 'Position vectors and components' },
              { id: 'mat-vectors-algebra-magnitude', name: 'Magnitude and direction' },
              { id: 'mat-vectors-algebra-products', name: 'Scalar and vector products' },
            ],
          },
          {
            id: 'mat-vectors-3d',
            name: 'Three-Dimensional Vectors',
            difficulty: 'Advanced',
            aliases: ['3D Vectors'],
            subtopics: [
              { id: 'mat-vectors-3d-resolution', name: 'Resolution into three mutually perpendicular directions' },
              { id: 'mat-vectors-3d-moment', name: 'Moment of a force about a point as a cross product' },
            ],
          },
          {
            id: 'mat-vectors-matrices',
            name: 'Matrices and Determinants',
            difficulty: 'Advanced',
            aliases: ['Matrices', 'Determinants'],
            subtopics: [
              { id: 'mat-vectors-matrices-operations', name: 'Matrix operations' },
              { id: 'mat-vectors-matrices-determinants', name: 'Determinants' },
              { id: 'mat-vectors-matrices-simultaneous', name: 'Simultaneous linear equations' },
            ],
          },
          {
            id: 'mat-vectors-transformations',
            name: 'Matrix Transformations',
            difficulty: 'Advanced',
            aliases: ['Linear Transformations'],
            subtopics: [
              { id: 'mat-vectors-transformations-linear', name: 'Linear transformations in two and three dimensions' },
              { id: 'mat-vectors-transformations-area', name: 'Determinants as area scale factors' },
            ],
          },
        ],
      },

      // ── 6. Statistics & Probability ───────────────────────────────────────
      {
        id: 'mat-stats',
        name: 'Statistics & Probability',
        icon: 'solar:chart-2-linear',
        aliases: ['Statistics & Probability', 'Probability', 'Statistics'],
        topics: [
          {
            id: 'mat-stats-descriptive',
            name: 'Descriptive Statistics',
            difficulty: 'Beginner',
            subtopics: [
              { id: 'mat-stats-descriptive-central', name: 'Mean, median and mode' },
              { id: 'mat-stats-descriptive-dispersion', name: 'Measures of dispersion' },
              { id: 'mat-stats-descriptive-grouped', name: 'Cumulative frequency tables and histograms' },
            ],
          },
          {
            id: 'mat-stats-distributions',
            name: 'Random Variables and Distributions',
            difficulty: 'Intermediate',
            aliases: ['Distribution Theory', 'Random Variables'],
            subtopics: [
              { id: 'mat-stats-distributions-tables', name: 'Discrete and continuous random variables' },
              { id: 'mat-stats-distributions-tables-build', name: 'Probability distribution tables' },
              { id: 'mat-stats-distributions-expectation', name: 'Expectation and variance of a discrete variable' },
            ],
          },
          {
            id: 'mat-stats-discrete',
            name: 'Discrete Distributions',
            difficulty: 'Advanced',
            aliases: ['Binomial Distribution', 'Poisson Distribution'],
            subtopics: [
              { id: 'mat-stats-discrete-binomial', name: 'Binomial distribution' },
              { id: 'mat-stats-discrete-poisson', name: 'Poisson distribution' },
            ],
          },
          {
            id: 'mat-stats-continuous',
            name: 'Continuous Distributions',
            difficulty: 'Advanced',
            aliases: ['Normal Distribution', 'Normal (Gaussian) Distribution'],
            subtopics: [
              { id: 'mat-stats-continuous-normal', name: 'Normal distribution' },
              { id: 'mat-stats-continuous-rule', name: 'The 68-95-99.7 rule' },
            ],
          },
          {
            id: 'mat-stats-correlation',
            name: 'Correlation and Regression',
            difficulty: 'Advanced',
            aliases: ['Correlation & Regression'],
            subtopics: [
              { id: 'mat-stats-correlation-scatter', name: 'Scatter diagrams' },
              { id: 'mat-stats-correlation-coefficient', name: 'Pearson correlation coefficient' },
              { id: 'mat-stats-correlation-regression', name: 'Regression equations and the line of best fit' },
            ],
          },
          {
            id: 'mat-stats-hypothesis',
            name: 'Hypothesis Testing',
            difficulty: 'Advanced',
            aliases: ['Chi-squared Tests', 'Confidence Intervals', 'Statistical Inference'],
            subtopics: [
              { id: 'mat-stats-hypothesis-chi', name: 'The chi-squared distribution' },
              { id: 'mat-stats-hypothesis-association', name: 'Chi-squared test of association and goodness of fit' },
              { id: 'mat-stats-hypothesis-intervals', name: 'Confidence intervals for a population mean' },
              { id: 'mat-stats-hypothesis-testing', name: 'Hypothesis testing of a mean or proportion' },
            ],
          },
        ],
      },

      // ── 7. Mechanics (Applied) ────────────────────────────────────────────
      {
        id: 'mat-mech',
        name: 'Mechanics',
        icon: 'solar:umbrella-linear',
        aliases: ['Mechanics', 'Applied Mechanics'],
        topics: [
          {
            id: 'mat-mech-kinematics',
            name: 'Kinematics and Straight-Line Motion',
            difficulty: 'Intermediate',
            subtopics: [
              { id: 'mat-mech-kinematics-quantities', name: 'Displacement, velocity and acceleration' },
              { id: 'mat-mech-kinematics-equations', name: 'Equations of motion' },
              { id: 'mat-mech-kinematics-graphs', name: 'Graphs of motion' },
            ],
          },
          {
            id: 'mat-mech-projectiles',
            name: 'Motion in Two Dimensions',
            difficulty: 'Advanced',
            aliases: ['Projectile Motion', 'Projectile Motion Scenario'],
            subtopics: [
              { id: 'mat-mech-projectiles-resolution', name: 'Resolution of vectors' },
              { id: 'mat-mech-projectiles-motion', name: 'Projectile motion' },
            ],
          },
          {
            id: 'mat-mech-dynamics',
            name: 'Forces and Dynamics',
            difficulty: 'Advanced',
            aliases: ['Dynamics'],
            subtopics: [
              { id: 'mat-mech-dynamics-connected', name: 'Newton’s laws applied to connected particles' },
              { id: 'mat-mech-dynamics-equilibrium', name: 'Equilibrium and resolving forces' },
              { id: 'mat-mech-dynamics-friction', name: 'Friction' },
            ],
          },
          {
            id: 'mat-mech-work',
            name: 'Work, Energy and Power',
            difficulty: 'Intermediate',
            aliases: ['Work, Energy & Power', 'Energy & Power'],
            subtopics: [
              { id: 'mat-mech-work-done', name: 'Work done' },
              { id: 'mat-mech-work-energy', name: 'Energy conservation and transfer' },
              { id: 'mat-mech-work-kinetic', name: 'Kinetic and potential energy' },
            ],
          },
          {
            id: 'mat-mech-momentum',
            name: 'Momentum',
            difficulty: 'Advanced',
            subtopics: [
              { id: 'mat-mech-momentum-linear', name: 'Linear momentum' },
              { id: 'mat-mech-momentum-collisions', name: 'Collisions' },
            ],
          },
          {
            id: 'mat-mech-circular',
            name: 'Circular Motion',
            difficulty: 'Advanced',
            aliases: ['Circular Motion'],
            subtopics: [
              { id: 'mat-mech-circular-force', name: 'Centripetal force' },
              { id: 'mat-mech-circular-banking', name: 'Banking of curves' },
            ],
          },
          {
            id: 'mat-mech-moments',
            name: 'Moments and Couples',
            difficulty: 'Intermediate',
            subtopics: [
              { id: 'mat-mech-moments-moment', name: 'Moment of a force' },
              { id: 'mat-mech-moments-couples', name: 'Couples and resultant moments' },
            ],
          },
          {
            id: 'mat-mech-statics',
            name: 'Statics',
            difficulty: 'Advanced',
            aliases: ['Statics'],
            subtopics: [
              { id: 'mat-mech-statics-cog', name: 'Centre of gravity' },
              { id: 'mat-mech-statics-equilibrium', name: 'Equilibrium of extended bodies' },
            ],
          },
        ],
      },

      // ── 8. Numerical Methods ──────────────────────────────────────────────
      {
        id: 'mat-numerical',
        name: 'Numerical Methods',
        icon: 'solar:settings-5-linear',
        aliases: ['Numerical Methods'],
        topics: [
          {
            id: 'mat-numerical-error',
            name: 'Approximation and Error',
            difficulty: 'Beginner',
            subtopics: [
              { id: 'mat-numerical-error-rounding', name: 'Rounding and significant figures' },
              { id: 'mat-numerical-error-types', name: 'Absolute, relative and percentage error' },
              { id: 'mat-numerical-error-bounds', name: 'Bounds and interval arithmetic' },
            ],
          },
          {
            id: 'mat-numerical-interpolation',
            name: 'Linear Interpolation and Extrapolation',
            difficulty: 'Intermediate',
            aliases: ['Interpolation', 'Curve Fitting'],
            subtopics: [
              { id: 'mat-numerical-interpolation-linear', name: 'Linear interpolation' },
              { id: 'mat-numerical-interpolation-extrapolation', name: 'Linear extrapolation' },
            ],
          },
          {
            id: 'mat-numerical-iterative',
            name: 'Iterative Methods',
            difficulty: 'Advanced',
            aliases: ['Iteration', 'Newton-Raphson'],
            subtopics: [
              { id: 'mat-numerical-iterative-simple', name: 'Simple iteration' },
              { id: 'mat-numerical-iterative-newton', name: 'Newton-Raphson method' },
            ],
          },
          {
            id: 'mat-numerical-newton-interpolation',
            name: "Newton's Difference Interpolation",
            difficulty: 'Advanced',
            aliases: ['Newton’s Forward Difference Formula'],
            subtopics: [
              { id: 'mat-numerical-newton-interpolation-formula', name: "Newton's forward difference formula" },
            ],
          },
        ],
      },
    ],
  },
};

export const SUBJECT_IDS = ['physics', 'mathematics'];

// Accepted exam level labels. Both A-Level and UACE currently resolve to the
// same topic tree (mirroring LEVEL_EQUIVALENTS in examBank.js), so the outline
// is level-agnostic today but keyed by level for future divergence.
export const SYLLABUS_LEVELS = ['A-Level', 'UACE'];

// URL level ids. Both are accepted on the way in, because links into /syllabus
// come from several places that were written at different times and used the
// raw label ('UACE') rather than the id ('uace'). Parsing only one form meant a
// student clicking back from a UACE topic exam landed on the A-Level outline with
// no visible reason why.
const LEVEL_IDS = { 'a-level': 'A-Level', alevel: 'A-Level', uace: 'UACE' };

// 'uace' | 'A-Level' | 'UACE' | null  ->  'A-Level' | 'UACE' | null
export function normalizeLevelId(value) {
  if (!value || typeof value !== 'string') return null;
  return LEVEL_IDS[value.trim().toLowerCase()] || null;
}

// The inverse, for building query strings: 'UACE' -> 'uace'.
export function levelToLevelId(label) {
  return label === 'UACE' ? 'uace' : 'a-level';
}

export function getSubject(subjectId) {
  if (!subjectId) return null;
  return SYLLABUS[normalizeSubject(subjectId)] || null;
}

// Accepts 'physics', 'Physics', 'PHYSICS' and returns the canonical subject id.
export function normalizeSubject(name) {
  if (!name || typeof name !== 'string') return null;
  const key = name.trim().toLowerCase();
  if (SUBJECT_IDS.includes(key)) return key;
  // Tolerate a truncated label ('phy', 'math') but only on a long enough prefix,
  // so a stray single character can never be pinned to a subject.
  if (key.length < 4) return null;
  return SUBJECT_IDS.find(id => id.startsWith(key)) || null;
}

export function getChapter(subjectId, chapterId) {
  const subject = getSubject(subjectId);
  if (!subject) return null;
  return subject.chapters.find(c => c.id === chapterId) || null;
}

export function getTopic(subjectId, topicId) {
  const subject = getSubject(subjectId);
  if (!subject) return null;
  for (const chapter of subject.chapters) {
    const topic = chapter.topics.find(t => t.id === topicId);
    if (topic) return { chapter, topic };
  }
  return null;
}

export function getSubtopic(subjectId, topicId, subtopicId) {
  const found = getTopic(subjectId, topicId);
  if (!found) return null;
  const subtopic = found.topic.subtopics.find(s => s.id === subtopicId);
  return subtopic ? { ...found, subtopic } : null;
}

// ─── Flat lists ─────────────────────────────────────────────────────────────

export function listChapters(subjectId) {
  return getSubject(subjectId)?.chapters || [];
}

export function listTopics(subjectId) {
  const subject = getSubject(subjectId);
  if (!subject) return [];
  return subject.chapters.flatMap(chapter =>
    chapter.topics.map(topic => ({ ...topic, chapterId: chapter.id, chapterName: chapter.name, subjectId: subject.id }))
  );
}

export function listSubtopics(subjectId) {
  return listTopics(subjectId).flatMap(topic =>
    topic.subtopics.map(subtopic => ({
      ...subtopic,
      subjectId: topic.subjectId,
      chapterId: topic.chapterId,
      topicId: topic.id,
      topicName: topic.name,
    }))
  );
}

export function countTopics(subjectId) {
  return listTopics(subjectId).length;
}

export function countSubtopics(subjectId) {
  return listSubtopics(subjectId).length;
}

// ─── Alias index ────────────────────────────────────────────────────────────

function normalizeKey(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// How specific a match is. When two things claim the same string, the more
// specific one wins, so a topic named 'Vector Algebra' is never shadowed by a
// chapter that also answers to that string.
const SPECIFICITY = { subtopic: 3, topic: 2, chapter: 1, subject: 0 };

// One index per subject, built once at module load.
//
// The index must be per-subject rather than global: Physics and Mathematics
// both have a topic called 'Statics' and both have 'Work, Energy and Power'.
// With a single global first-wins map, those keys are owned by whichever
// subject was walked first, and a Mathematics question would then be credited
// to a Physics topic.
const SUBJECT_INDEX = (() => {
  const indexes = {};

  SUBJECT_IDS.forEach(subjectId => {
    const map = new Map();

    const register = (key, ref) => {
      const k = normalizeKey(key);
      if (!k) return;
      const existing = map.get(k);
      if (existing && SPECIFICITY[existing.level] >= SPECIFICITY[ref.level]) return;
      map.set(k, ref);
    };

    const subject = SYLLABUS[subjectId];

    (subject.subjectAliases || []).forEach(alias =>
      register(alias, { level: 'subject', subjectId })
    );

    subject.chapters.forEach(chapter => {
      register(chapter.name, { level: 'chapter', subjectId, chapterId: chapter.id });
      (chapter.aliases || []).forEach(alias =>
        register(alias, { level: 'chapter', subjectId, chapterId: chapter.id })
      );

      chapter.topics.forEach(topic => {
        register(topic.name, { level: 'topic', subjectId, chapterId: chapter.id, topicId: topic.id });
        (topic.aliases || []).forEach(alias =>
          register(alias, { level: 'topic', subjectId, chapterId: chapter.id, topicId: topic.id })
        );

        topic.subtopics.forEach(subtopic => {
          register(subtopic.name, {
            level: 'subtopic', subjectId, chapterId: chapter.id, topicId: topic.id, subtopicId: subtopic.id,
          });
          (subtopic.aliases || []).forEach(alias =>
            register(alias, {
              level: 'subtopic', subjectId, chapterId: chapter.id, topicId: topic.id, subtopicId: subtopic.id,
            })
          );
        });
      });
    });

    indexes[subjectId] = map;
  });

  return indexes;
})();

// Resolves a free-text topic string (as recorded on an exam breakdown item or a
// practice scenario) to a place in the outline. Returns null when the string is
// not recognised, so callers can report unattributed content rather than
// silently dropping it.
//
// `subjectHint` narrows the search. When given, the search does NOT fall
// through to the other subject: a string that is unknown in the hinted subject
// is reported as unknown, which is what keeps 'Statics' from resolving to the
// Physics topic while processing a Mathematics question.
export function resolveTopicRef(name, subjectHint = null) {
  const key = normalizeKey(name);
  if (!key) return null;

  const hinted = normalizeSubject(subjectHint);
  if (hinted) {
    const scoped = SUBJECT_INDEX[hinted].get(key);
    if (scoped) return scoped;
    // Only a genuine subject name lands at subject level. Anything else is a
    // tag we cannot place, and saying so (null) is the honest answer: returning
    // the subject for every miss would quietly file stray content under the
    // subject's overall accuracy and make unrecognisable tags look like real
    // coverage. A paper-level tag such as 'Applied Mathematics' is a subject
    // name, so it still resolves here.
    if (normalizeSubject(key) === hinted) return { level: 'subject', subjectId: hinted };
    return null;
  }

  for (const subjectId of SUBJECT_IDS) {
    const hit = SUBJECT_INDEX[subjectId].get(key);
    if (hit) return hit;
  }

  // Last resort: the string is a subject name, and no subject hint was given.
  const subjectId = normalizeSubject(key);
  if (subjectId) return { level: 'subject', subjectId };

  return null;
}

// ─── Content resolution ─────────────────────────────────────────────────────

// Resolves one piece of content — an exam question, a scenario, or a practice
// attempt — to a place in the outline, given its subject and the free-text topic
// string (plus any extra topic tags) it recorded for itself.
//
// A specific (subtopic/topic) match always beats a broad chapter match, so a
// scenario tagged ['Classical Mechanics', 'Fluid Mechanics'] credits Fluid
// Mechanics rather than dumping everything on the Mechanics chapter. This lives
// here rather than in syllabusProgress.js because both the progress engine and
// the practice scenario picker need it, and syllabusProgress imports the
// scenario bank — putting it there would be a cycle.
//
// It is the single attribution rule. Anything that decides "does this piece of
// content belong to this topic?" must go through here, otherwise the count shown
// on /syllabus and the question the workboard actually serves drift apart.
export function resolveContentRef(subject, topicName, topicTags = null) {
  const candidates = [topicName, ...(Array.isArray(topicTags) ? topicTags : [])];
  let chapterRef = null;
  let subjectRef = null;

  for (const candidate of candidates) {
    if (!candidate) continue;
    const ref = resolveTopicRef(candidate, subject);
    if (!ref) continue;
    if (ref.level === 'subtopic' || ref.level === 'topic') return ref;
    if (ref.level === 'chapter' && !chapterRef) chapterRef = ref;
    if (ref.level === 'subject' && !subjectRef) subjectRef = ref;
  }

  return chapterRef || subjectRef;
}

// All names (canonical + aliases) that resolve to a given topic. Used by
// practice/scenario pickers so they can filter content the same way the
// progress engine attributes it.
export function topicNameVariants(subjectId, topicId) {
  const found = getTopic(subjectId, topicId);
  if (!found) return [];
  return [found.topic.name, ...(found.topic.aliases || [])];
}

export function chapterNameVariants(subjectId, chapterId) {
  const chapter = getChapter(subjectId, chapterId);
  if (!chapter) return [];
  return [chapter.name, ...(chapter.aliases || [])];
}

// Every search term in the outline, for the global search modal.
export function searchIndex() {
  return SUBJECT_IDS.flatMap(subjectId => {
    const subject = SYLLABUS[subjectId];
    return subject.chapters.flatMap(chapter =>
      chapter.topics.flatMap(topic => [
        {
          id: `topic-${topic.id}`,
          type: 'Topic',
          title: topic.name,
          description: `${subject.name} · ${chapter.name}`,
          subjectId,
          chapterId: chapter.id,
          topicId: topic.id,
        },
        ...topic.subtopics.map(subtopic => ({
          id: `subtopic-${subtopic.id}`,
          type: 'Subtopic',
          title: subtopic.name,
          description: `${subject.name} · ${chapter.name} · ${topic.name}`,
          subjectId,
          chapterId: chapter.id,
          topicId: topic.id,
          subtopicId: subtopic.id,
        })),
      ])
    );
  });
}
