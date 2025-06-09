This is an inline $\sqrt{x + 10}$ math expression.

It's better to get that $$ \left( \sum_{k=1}^n a_k b_k \right)^2 $$
on its own line. A math block may also be more convenient:

```math
\left( \sum_{k=1}^n a_k b_k \right)^2 < \Phi
```

```c
#include <stdio.h>

int main(void)
{
    puts("hey");
}
```

```python
from pygments import highlight
from pygments.lexers import get_lexer_by_name
from pygments.formatters import HtmlFormatter

lexer = get_lexer_by_name("python", stripall=True)
formatter = HtmlFormatter(linenos=True, cssclass="source")
result = highlight(code, lexer, formatter)
```
