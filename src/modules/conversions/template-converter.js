const MANUAL_TODO = '{/* TODO: manual conversion required */}';

const TEMPLATE_TAGS = [
  {
    name: 'the_title',
    expression: 'post.title.rendered',
    dangerousElement: 'span',
  },
  {
    name: 'the_content',
    expression: 'post.content.rendered',
    dangerousElement: 'div',
  },
  {
    name: 'the_excerpt',
    expression: 'post.excerpt.rendered',
    dangerousElement: 'div',
  },
  {
    name: 'the_date',
    expression: 'new Date(post.date).toLocaleDateString()',
  },
  {
    name: 'get_the_ID',
    expression: 'post.id',
  },
  {
    name: 'the_author',
    expression: 'post._embedded?.author?.[0]?.name',
  },
];

const CONDITIONAL_TAGS = ['is_single', 'is_page', 'is_archive'];

class TemplateConverter {
  convert(phpContent, templateName = 'ConvertedTemplate') {
    const componentName = this.toComponentName(templateName);

    let jsx = phpContent || '';

    jsx = this.stripWordPressBlockComments(jsx);
    jsx = this.convertEscapedTextHelpers(jsx);
    jsx = this.convertTemplateDirectoryImages(jsx);
    jsx = this.convertTemplateDirectoryReferences(jsx);
    jsx = this.convertLoops(jsx);
    jsx = this.convertConditionals(jsx);
    jsx = this.convertElementWrappedTemplateTags(jsx);
    jsx = this.convertAttributeTemplateTags(jsx);
    jsx = this.convertTemplateTags(jsx);
    jsx = this.convertBlogInfo(jsx);
    jsx = this.convertEchoStatements(jsx);
    jsx = this.convertTemplateDirectoryReferences(jsx);
    jsx = this.replaceUnknownPhpBlocks(jsx);
    jsx = this.normalizeJsxAttributes(jsx);
    jsx = this.normalizeInlineStyles(jsx);
    jsx = this.cleanWhitespace(jsx);

    return `export default function ${componentName}() {
  return (
    <>
${this.indent(jsx, 6)}
    </>
  );
}
`;
  }
  stripWordPressBlockComments(content) {
    return content.replace(/<!--[\s\S]*?-->/g, '');
    }

    convertEscapedTextHelpers(content) {
    return content
        .replace(
        /<\?php\s*echo\s+esc_html_x\s*\(\s*(['"])(.*?)\1\s*,\s*(['"])(.*?)\3\s*,\s*(['"])(.*?)\5\s*\)\s*;?\s*\?>/gi,
        (_, quote, text) => text,
        )
        .replace(
        /<\?php\s*echo\s+esc_html__\s*\(\s*(['"])(.*?)\1\s*,\s*(['"])(.*?)\3\s*\)\s*;?\s*\?>/gi,
        (_, quote, text) => text,
        )
        .replace(
        /<\?php\s*echo\s+esc_html\s*\(\s*([^)]*)\s*\)\s*;?\s*\?>/gi,
        '{/* TODO: manual conversion required */}',
        );
    }
    normalizeInlineStyles(content) {
        return content.replace(/\sstyle=["']([^"']*)["']/gi, (_, styleValue) => {
            const styleEntries = styleValue
            .split(';')
            .map((rule) => rule.trim())
            .filter(Boolean)
            .map((rule) => {
                const colonIndex = rule.indexOf(':');

                if (colonIndex === -1) {
                return null;
                }

                const cssProperty = rule.slice(0, colonIndex).trim();
                const cssValue = rule
                .slice(colonIndex + 1)
                .trim()
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'");

                const jsxProperty = cssProperty.startsWith('--')
                ? `'${cssProperty}'`
                : cssProperty.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

                return `${jsxProperty}: '${cssValue}'`;
            })
            .filter(Boolean);

            if (styleEntries.length === 0) {
            return ' style={{}}';
            }

            return ` style={{ ${styleEntries.join(', ')} }}`;
        });
        }
    convertTemplateDirectoryImages(content) {
    return content.replace(
        /src=["']<\?php\s*echo\s+esc_url\s*\(\s*get_template_directory_uri\s*\(\s*\)\s*\)\s*;?\s*\?>([^"']+)["']/gi,
        'src="/wp-assets$1"',
    );
    }
    
    convertTemplateDirectoryReferences(content) {
        return content
            .replace(
            /<\?php\s*echo\s+esc_url\s*\(\s*get_template_directory_uri\s*\(\s*\)\s*\)\s*;?\s*\?>/gi,
            '/wp-assets',
            )
            .replace(
            /<\?php\s*echo\s+esc_url\s*\(\s*get_stylesheet_directory_uri\s*\(\s*\)\s*\)\s*;?\s*\?>/gi,
            '/wp-assets',
            )
            .replace(
            /\{\s*esc_url\s*\(\s*get_template_directory_uri\s*\(\s*\)\s*\)\s*\}/gi,
            '/wp-assets',
            )
            .replace(
            /\{\s*esc_url\s*\(\s*get_stylesheet_directory_uri\s*\(\s*\)\s*\)\s*\}/gi,
            '/wp-assets',
            );
        }
  convertLoops(content) {
    let converted = content;

    const combinedLoopPattern =
      /<\?php\s*if\s*\(\s*have_posts\s*\(\s*\)\s*\)\s*:\s*while\s*\(\s*have_posts\s*\(\s*\)\s*\)\s*:\s*the_post\s*\(\s*\)\s*;?\s*\?>\s*([\s\S]*?)\s*<\?php\s*endwhile\s*;\s*endif\s*;\s*\?>/gi;

    converted = converted.replace(combinedLoopPattern, (_, loopBody) =>
      this.buildMapOutput(loopBody),
    );

    const separatedLoopPattern =
      /<\?php\s*if\s*\(\s*have_posts\s*\(\s*\)\s*\)\s*:\s*\?>\s*<\?php\s*while\s*\(\s*have_posts\s*\(\s*\)\s*\)\s*:\s*the_post\s*\(\s*\)\s*;?\s*\?>\s*([\s\S]*?)\s*<\?php\s*endwhile\s*;\s*\?>\s*<\?php\s*endif\s*;\s*\?>/gi;

    converted = converted.replace(separatedLoopPattern, (_, loopBody) =>
      this.buildMapOutput(loopBody),
    );

    return converted;
  }

  buildMapOutput(loopBody) {
    let convertedLoopBody = loopBody.trim();

    convertedLoopBody = this.convertElementWrappedTemplateTags(convertedLoopBody);
    convertedLoopBody = this.convertAttributeTemplateTags(convertedLoopBody);
    convertedLoopBody = this.convertTemplateTags(convertedLoopBody);
    convertedLoopBody = this.convertBlogInfo(convertedLoopBody);
    convertedLoopBody = this.convertEchoStatements(convertedLoopBody);
    convertedLoopBody = this.convertTemplateDirectoryReferences(convertedLoopBody);
    convertedLoopBody = this.replaceUnknownPhpBlocks(convertedLoopBody);
    convertedLoopBody = this.normalizeJsxAttributes(convertedLoopBody);
    convertedLoopBody = this.normalizeInlineStyles(convertedLoopBody);
    convertedLoopBody = this.addKeyToFirstElement(convertedLoopBody);
    return `{posts.map(post => (
${this.indent(convertedLoopBody, 2)}
))}`;
  }

  convertConditionals(content) {
    return CONDITIONAL_TAGS.reduce((currentContent, tagName) => {
      const conditionalPattern = new RegExp(
        `<\\?php\\s*if\\s*\\(\\s*${tagName}\\s*\\(\\s*\\)\\s*\\)\\s*:\\s*\\?>`,
        'gi',
      );

      return currentContent
        .replace(
          conditionalPattern,
          `{/* TODO: add routing condition for ${tagName}() */}`,
        )
        .replace(/<\?php\s*endif\s*;\s*\?>/gi, '');
    }, content);
  }

  convertElementWrappedTemplateTags(content) {
    let converted = content;

    TEMPLATE_TAGS.forEach((tag) => {
      if (!tag.dangerousElement) {
        return;
      }

      const pattern = new RegExp(
        `<([a-z][a-z0-9]*)\\b([^>]*)>\\s*<\\?php\\s*${tag.name}\\s*\\(\\s*\\)\\s*;?\\s*\\?>\\s*<\\/\\1>`,
        'gi',
      );

      converted = converted.replace(
        pattern,
        `<$1$2 dangerouslySetInnerHTML={{ __html: ${tag.expression} }} />`,
      );
    });

    return converted;
  }

  convertAttributeTemplateTags(content) {
    return content
      .replace(
        /href=["']<\?php\s*(?:the_permalink|get_permalink)\s*\(\s*\)\s*;?\s*\?>["']/gi,
        'href={post.link}',
      )
      .replace(
        /value=["']<\?php\s*get_the_ID\s*\(\s*\)\s*;?\s*\?>["']/gi,
        'value={post.id}',
      );
  }

  convertTemplateTags(content) {
    let converted = content;

    TEMPLATE_TAGS.forEach((tag) => {
      const pattern = new RegExp(
        `<\\?php\\s*${tag.name}\\s*\\(\\s*\\)\\s*;?\\s*\\?>`,
        'gi',
      );

      if (tag.dangerousElement) {
        converted = converted.replace(
          pattern,
          `<${tag.dangerousElement} dangerouslySetInnerHTML={{ __html: ${tag.expression} }} />`,
        );
        return;
      }

      converted = converted.replace(pattern, `{${tag.expression}}`);
    });

    return converted
      .replace(/<\?php\s*the_permalink\s*\(\s*\)\s*;?\s*\?>/gi, '{post.link}')
      .replace(/<\?php\s*get_permalink\s*\(\s*\)\s*;?\s*\?>/gi, '{post.link}');
  }

  convertBlogInfo(content) {
    return content.replace(
      /<\?php\s*bloginfo\s*\(\s*['"]name['"]\s*\)\s*;?\s*\?>/gi,
      '{process.env.NEXT_PUBLIC_SITE_NAME}',
    );
  }

  convertEchoStatements(content) {
    return content
      .replace(/<\?=\s*([^?]+)\s*\?>/gi, (_, expression) =>
        `{${this.convertPhpExpression(expression)}}`,
      )
      .replace(/<\?php\s*echo\s+([^;]+)\s*;\s*\?>/gi, (_, expression) =>
        `{${this.convertPhpExpression(expression)}}`,
      );
  }

  convertPhpExpression(expression) {
    return expression
      .trim()
      .replace(/\$/g, '')
      .replace(/->/g, '.')
      .replace(/;$/, '');
  }

  replaceUnknownPhpBlocks(content) {
    return content
        .replace(/<\?(?:php|=)?[\s\S]*?\?>/gi, MANUAL_TODO)
        .replace(/<\?(?:php|=)?[\s\S]*$/gi, MANUAL_TODO);
    }

  normalizeJsxAttributes(content) {
    return content
      .replace(/\sclass=/gi, ' className=')
      .replace(/\sfor=/gi, ' htmlFor=');
  }

  addKeyToFirstElement(content) {
    if (/key=\{post\.id\}/.test(content)) {
      return content;
    }

    return content.replace(
      /<([A-Za-z][A-Za-z0-9.-]*)(\s|>)/,
      (match, tagName, suffix) => {
        if (suffix === '>') {
          return `<${tagName} key={post.id}>`;
        }

        return `<${tagName} key={post.id}${suffix}`;
      },
    );
  }

  toComponentName(templateName) {
    const baseName = String(templateName)
      .split('/')
      .pop()
      .replace(/\.[^.]+$/, '');

    const componentName = baseName
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');

    if (!componentName) {
      return 'ConvertedTemplate';
    }

    if (/^[0-9]/.test(componentName)) {
      return `Component${componentName}`;
    }

    return componentName;
  }

  indent(content, spaces) {
    const padding = ' '.repeat(spaces);

    return String(content)
      .split('\n')
      .map((line) => (line.trim() ? `${padding}${line}` : line))
      .join('\n');
  }

  cleanWhitespace(content) {
    return String(content).replace(/\n{3,}/g, '\n\n').trim();
  }
}

module.exports = {
  TemplateConverter,
};