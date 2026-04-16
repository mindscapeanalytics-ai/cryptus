import React from 'react';

export function JsonLd() {
  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "RSIQ Pro",
    "operatingSystem": "Web, iOS, Android",
    "applicationCategory": "FinancialApplication",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "ratingCount": "1250"
    },
    "offers": {
      "@type": "Offer",
      "price": "0.00",
      "priceCurrency": "USD"
    },
    "description": "Enterprise-grade multi-indicator crypto market scanner by Mindscape Analytics. Real-time RSI, MACD, Order Flow, and Liquidation Flux analytics."
  };

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "FinancialService",
    "name": "Mindscape Analytics LLC",
    "image": "https://rsiq.mindscapeanalytics.com/logo/rsiq-mindscapeanalytics.png",
    "@id": "https://rsiq.mindscapeanalytics.com",
    "url": "https://rsiq.mindscapeanalytics.com",
    "telephone": "",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "",
      "addressLocality": "Global",
      "addressRegion": "",
      "postalCode": "",
      "addressCountry": "US"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 0,
      "longitude": 0
    },
    "openingHoursSpecification": {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": [
        "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
      ],
      "opens": "00:00",
      "closes": "23:59"
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify([softwareSchema, serviceSchema]) }}
    />
  );
}
