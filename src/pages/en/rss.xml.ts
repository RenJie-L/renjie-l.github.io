import rss from '@astrojs/rss';

export function GET(context: { site?: URL }) {
  return rss({
    title: 'Renjie Writing — English',
    description:
      'English writing on frontend engineering, AI-assisted development, and intelligent applications.',
    site: context.site!,
    items: [],
    customData: '<language>en</language>',
  });
}
