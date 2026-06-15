document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('.page-header');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    header?.classList.add('intro-ready');
    document.querySelectorAll('.journey-step').forEach((step) => step.classList.add('is-visible'));
    document.querySelector('.journey-cases')?.classList.add('is-visible');
    document.querySelector('.channel-targeting')?.classList.add('is-visible');
  } else {
    requestAnimationFrame(() => {
      header?.classList.add('intro-ready');
    });
  }

  const journeySteps = document.querySelectorAll('.journey-step');
  if (journeySteps.length) {
    if (prefersReducedMotion) {
      journeySteps.forEach((step) => step.classList.add('is-visible'));
    } else {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.25, rootMargin: '0px 0px -40px 0px' }
      );

      journeySteps.forEach((step) => observer.observe(step));
    }
  }

  const journeyCases = document.querySelector('.journey-cases');

  if (journeyCases) {
    if (prefersReducedMotion) {
      journeyCases.classList.add('is-visible');
    } else {
      const caseObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              caseObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.2, rootMargin: '0px 0px -80px 0px' }
      );

      caseObserver.observe(journeyCases);
    }
  }

  const channelTargeting = document.querySelector('.channel-targeting');

  if (channelTargeting) {
    if (prefersReducedMotion) {
      channelTargeting.classList.add('is-visible');
    } else {
      const targetingObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              targetingObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
      );

      targetingObserver.observe(channelTargeting);
    }
  }

  const stickyInquiryLink = document.getElementById('stickyInquiryLink');

  if (stickyInquiryLink) {
    stickyInquiryLink.addEventListener('click', (event) => {
      const loginUrl = stickyInquiryLink.href;
      if (!loginUrl || loginUrl.endsWith('#')) return;

      event.preventDefault();

      if (typeof gtag === 'function') {
        gtag('event', 'click_create_campaign', {
          event_category: 'sticky_cta',
          event_label: '광고 캠페인 직접 만들기',
        });
      }

      window.open(loginUrl, '_blank', 'noopener,noreferrer');
    });
  }
});
