# Statistical draft review — not the production method

Base: `8f39f2d`. These files preserve Claude's unfinished experiments before
the continuation restored the established production rules. They are not
used by the app, build or published findings.

`production-draft.patch.gz` is the complete binary-capable diff of the draft
statistics, evidence extraction, both modified global statistics files and
summary. `draft-sha256.json` records their hashes. The original temporary
calibration/simulation scripts and findings generator are preserved as text.
Nothing here establishes a validated new scientific procedure.

## Review decision

Retain the production ΔBIC >6 plus residual-trend p≥0.05 integrity screen as
an explicitly heuristic diagnostic. Retain overlap of marginal 95% intervals
as a descriptive comparison; it does not demonstrate equal rates. Do not
publish the draft's claimed 5% jump error control or Gaussian rate-difference
test as established methods.

Reasons:

1. The proposed persistence thresholds were calibrated for complete 44-year
   series and one segment length. The app also supports shorter and gapped
   windows. The review found 8,444 temperature cells whose witness had only
   16–43 finite years. Pooling simulations by estimated persistence does not
   establish worst-case control for every true persistence, nor a finite
   upper confidence bound on the false-alarm rate. The claimed table was not
   independently reproduced during this review.
2. The draft obtains Gaussian standard errors by dividing Sen interval
   widths by 3.92, then assumes zero covariance. That approximation and the
   cross-record dependence have not been validated. Shared observations do
   not, by themselves, establish the sign or size of covariance. The
   uncertainty of a difference includes covariance; see
   [NIST's propagation formula](https://www.nist.gov/pml/nist-technical-note-1297/nist-tn-1297-appendix-law-propagation-uncertainty).
3. The original findings generator assigned distinct ranks to equal
   coverage values. It produced a rainfall correlation despite constant
   coverage, and its answer changed with row order. The accepted generator
   now uses average tied ranks and returns null for constant input, consistent
   with [SciPy rankdata](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.rankdata.html)
   and [Spearman's constant-input limitation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.spearmanr.html).
4. Availability of a gridded witness value does not measure station density
   or observational quality. A coverage correlation cannot establish whether
   a product is reliable in a country.
5. Method text and the independent validator did not cover the proposed
   changed decision rules. Matching an implementation is not validation of
   its scientific assumptions.

The step model already counts four parameters (two means, break location
and variance), versus three for the line. Its heuristic still lacks a
calibrated false-positive rate after breakpoint search and under persistence.
Failure to reject the residual trend is not proof that no trend remains.

The draft leaves all six floating-point statistics columns unchanged but
changes categorical decisions: temperature flagged area falls from 4.76%
to 1.76%, rainfall from 13.45% to 7.73%. It also changes 3,427 temperature
and 410 rainfall agreement classes. Fewer flags alone do not demonstrate
greater accuracy.

## What remains research

A paired annual difference series could diagnose whether two records drift
apart while retaining their cross-record dependence. Its estimand must be
stated: Sen(a−b) generally differs from Sen(a)−Sen(b). Serial dependence,
missing data, breakpoint search and supported window lengths all need an
independently reviewed validation plan before changing published decisions.

To examine the archived draft, use an isolated checkout at the base commit,
decompress and apply the patch there, restore `crossExamine-draft.ts.txt` to
`src/lib/crossExamine.ts`, and copy the simulation sources back under
`scripts/` with their `.ts` extensions. Do not apply this patch to production
or regenerate the shipped binaries as part of an ordinary build.
