---
title: The Source Pack Methodology: How Senior Sourcers Structure a Hard Search Before Touching LinkedIn
description: A practical SourcingOS guide to search lanes, source packs, donor companies, false positives, and role-specific search strategy for hard-to-fill recruiting work.
category: Sourcing Methodology
slug: source-pack-methodology
cta: Build a source pack in SourcingOS
---

# The Source Pack Methodology: How Senior Sourcers Structure a Hard Search Before Touching LinkedIn

Most sourcing failures start before the first search string is typed. The recruiter jumps into LinkedIn, runs a broad title search, gets the same obvious profiles everyone else has already seen, and then concludes the market is dry.

The better move is to build a source pack first.

A source pack is a working search plan for one hard-to-fill role. It defines the role, the must-have evidence, the likely donor companies, the search lanes, the Boolean strings, the false positives, and the stop rules. It turns sourcing from “try harder” into a repeatable operating system.

## What a source pack includes

A useful source pack has six parts.

1. **Role translation.** Convert the job description into plain-language work: what the person will actually do, what systems they will touch, what domain they come from, and what evidence proves they can do it.
2. **Must-have evidence.** Separate required evidence from nice-to-have keywords. A must-have is something you need to verify before advancing the candidate.
3. **Search lanes.** Break the market into separate lanes instead of one giant query. Common lanes include direct-fit, adjacent-title, donor-company, open-source evidence, community/conference, and rediscovery.
4. **Source-specific strings.** Build strings for LinkedIn, Google X-Ray, GitHub, resume/PDF search, job boards, ATS rediscovery, and any niche source.
5. **False-positive rules.** Define what to exclude before you waste time reviewing the wrong profiles.
6. **Hiring manager tradeoffs.** Document what can be loosened if the market is too thin: location, title, years of experience, nice-to-have stack, industry, or clearance timing.

## The five-lane model

A search lane is a hypothesis. You are not searching “the whole market.” You are testing one slice of the market.

**Lane 1: Direct fit.** People with the exact title, domain, and stack. This is usually high precision and low volume.

**Lane 2: Adjacent title.** People doing similar work under different titles. For DevSecOps, that may include platform engineer, cloud engineer, SRE, systems engineer, automation engineer, or infrastructure engineer.

**Lane 3: Donor-company map.** Companies likely to produce the talent. For GovCon roles, this may include GDIT, Leidos, Booz Allen, CACI, SAIC, Peraton, ManTech, Maximus, Lockheed Martin, Northrop Grumman, and Raytheon.

**Lane 4: Evidence source.** Open-source, publications, conference talks, Stack Overflow tags, GitHub repos, OpenAlex profiles, Hugging Face models, or portfolio evidence.

**Lane 5: Rediscovery.** Previous candidates, silver medalists, old ATS records, previously contacted leads, referrals, and candidates who were rejected for reasons that no longer apply.

## Example source pack: Cleared DevSecOps

Strict market:
- Senior DevSecOps Engineer, Platform Engineer, Cloud Engineer, SRE
- TS/SCI or Secret as a requirement to verify manually
- AWS GovCloud, Terraform, Kubernetes, Docker, CI/CD, Linux, Python or Bash
- RMF, ATO, NIST, FedRAMP, DoD, IC, or federal delivery evidence
- DMV / Northern Virginia / DC metro if on-site or hybrid

Expanded market:
- Systems Engineer with automation depth
- Cloud Engineer with secure government delivery evidence
- Kubernetes engineer from a GovCon prime
- Security engineer with CI/CD and infrastructure as code

False positives:
- Help desk
- Desktop support
- Training-only profiles
- Bootcamp-only experience
- Sales engineers without delivery ownership
- Managers too far from hands-on work

## Starter strings

LinkedIn / ATS balanced:

```text
("DevSecOps Engineer" OR "Platform Engineer" OR "Cloud Engineer" OR "Site Reliability Engineer" OR SRE) AND (Terraform OR Kubernetes OR Docker OR "CI/CD" OR Jenkins) AND ("AWS GovCloud" OR FedRAMP OR RMF OR ATO OR NIST OR DoD) NOT (intern OR student OR "help desk" OR "desktop support" OR sales)
```

Google X-Ray:

```text
site:linkedin.com/in ("DevSecOps Engineer" OR "Platform Engineer" OR "Cloud Engineer") (Terraform OR Kubernetes OR "AWS GovCloud" OR FedRAMP OR RMF OR ATO) -jobs -recruiter -training
```

GitHub evidence lane:

```text
site:github.com (Terraform OR Kubernetes OR Docker OR Ansible) (GovCloud OR FedRAMP OR DoD OR NIST OR RMF) -jobs -recruiter
```

## How to use the source pack with a hiring manager

The source pack gives you a better conversation than “I need more candidates.” It lets you say:

- “Here is the strict market.”
- “Here is the expanded market.”
- “Here are the false positives we are filtering out.”
- “Here are the lanes we have already tested.”
- “Here is what happens if we loosen location, clearance timing, or title.”

That changes the relationship with the hiring manager. You are no longer defending activity. You are showing market logic.

## CTA

Use the SourcingOS JD Strategy tool to turn a messy req into a first-pass source pack, then move into the private beta for Candidate 360, evidence matrix, project memory, and rediscovery.
