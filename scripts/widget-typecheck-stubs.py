"""Prepara dei finti R, MainActivity e librerie di prova, solo per far controllare i tipi a javac."""
import os, re, glob, sys
repo = sys.argv[1]
out = sys.argv[2]
res = os.path.join(repo, 'android/app/src/main/res')
names = {'id': set(), 'layout': set(), 'drawable': set(), 'color': set(), 'dimen': set(), 'string': set(), 'xml': set(), 'mipmap': set()}
for d in glob.glob(res + '/*'):
    kind = os.path.basename(d).split('-')[0]
    for f in glob.glob(d + '/*'):
        text = open(f, encoding='utf-8', errors='ignore').read() if f.endswith('.xml') else ''
        base = os.path.splitext(os.path.basename(f))[0]
        if kind in ('layout', 'drawable', 'xml', 'mipmap'):
            names[kind].add(base)
        if kind == 'values':
            for k, n in re.findall(r'<(color|dimen|string)\s+name="([^"]+)"', text):
                names[k].add(n)
        for n in re.findall(r'@\+id/([A-Za-z0-9_]+)', text):
            names['id'].add(n)
def w(path, text):
    full = os.path.join(out, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    open(full, 'w', encoding='utf-8').write(text)
body = ''
n = 1
for kind, items in names.items():
    body += f'  public static final class {kind} {{\n'
    for item in sorted(items):
        body += f'    public static final int {item} = {n};\n'
        n += 1
    body += '  }\n'
w('com/nikcirri/calendario/R.java', 'package com.nikcirri.calendario;\npublic final class R {\n' + body + '}\n')
w('com/nikcirri/calendario/MainActivity.java', 'package com.nikcirri.calendario;\npublic class MainActivity extends android.app.Activity {}\n')
w('androidx/annotation/RequiresApi.java', 'package androidx.annotation;\npublic @interface RequiresApi { int value() default 1; int api() default 1; }\n')
w('org/junit/Test.java', 'package org.junit;\nimport java.lang.annotation.*;\n@Retention(RetentionPolicy.RUNTIME) public @interface Test {}\n')
w('org/junit/Before.java', 'package org.junit;\nimport java.lang.annotation.*;\n@Retention(RetentionPolicy.RUNTIME) public @interface Before {}\n')
w('org/junit/runner/RunWith.java', 'package org.junit.runner;\npublic @interface RunWith { Class<?> value(); }\n')
w('org/junit/Assert.java', '''package org.junit;
public class Assert {
  public static void assertTrue(boolean c) {}
  public static void assertTrue(String m, boolean c) {}
  public static void assertFalse(boolean c) {}
  public static void assertFalse(String m, boolean c) {}
  public static void assertEquals(long a, long b) {}
  public static void assertEquals(String m, long a, long b) {}
  public static void assertEquals(Object a, Object b) {}
  public static void assertEquals(String m, Object a, Object b) {}
  public static void assertNotNull(Object o) {}
  public static void assertNotNull(String m, Object o) {}
  public static void assertNull(Object o) {}
  public static void assertNull(String m, Object o) {}
}
''')
w('androidx/test/ext/junit/runners/AndroidJUnit4.java', 'package androidx.test.ext.junit.runners;\npublic class AndroidJUnit4 {}\n')
w('androidx/test/platform/app/InstrumentationRegistry.java', '''package androidx.test.platform.app;
public class InstrumentationRegistry {
  public static android.app.Instrumentation getInstrumentation() { return null; }
  public static android.os.Bundle getArguments() { return null; }
}
''')
w('androidx/test/core/app/ActivityScenario.java', '''package androidx.test.core.app;
public class ActivityScenario<A extends android.app.Activity> implements AutoCloseable, java.io.Closeable {
  public interface ActivityAction<A extends android.app.Activity> { void perform(A activity); }
  public static <A extends android.app.Activity> ActivityScenario<A> launch(Class<A> c) { return null; }
  public ActivityScenario<A> onActivity(ActivityAction<A> action) { return this; }
  @Override public void close() {}
}
''')
