---
title: "C++（更新中）"
description: "C++ 入门笔记：程序结构、类与继承、运算符重载与 STL 栈。"
pubDate: "2021-06-21"
category: "正文"
cover: ""
status: published
tags:
  - C++
  - 面向对象
links:
  - C语言指针强化（更新中）
references: []
original_url: "https://soft-fang.github.io/2021/06/21/C++/"
---

# 程序结构

```cpp
#include<iostream>  //引入函数库
using namespace std; //告诉编译器使用std命名空间
int main()
{
    cout << "Hello,world!" ;  //屏幕显示Hello,world!

    cout << "Hello,world!" << endl; //屏幕显示Hello,world! 并换行
    return 0;
}
```

输出是一个流，即从程序流出的一系列字符，cout的作用就是将<<(插入运算符)右侧的信息插入到流中。

# 数据类型

枚举类型 enum

enum 枚举名{

​ 标识符[=整型常数]，

​ 标识符[=整型常数]，

…

​ 标识符[=整型常数]

}枚举变量；

```cpp
enum color {red,green,blue} c;
//c的类型就会为color，最后c会被赋值为“blue”
//默认名称数值第一个为0 第二个为1 第三个为2...
//也可主动赋值
enum color {red,green=5,blue} c;
//此时red=0 blue=6  默认每个名称比前面一个大 1
```

# 常量

const 关键词

const type variable = value;

前缀声明某一类型的常量

在声明时就要对const进行初始化。

const比#define更好 ：const能明确指定类型，可以将作用域控制在指定的函数或文件中。

# 字符串输入

(cin >> str).get(); 比 cin.get(str); 更好

因为当cin.get(str)；遇到空格符后会将空格符留在队列中会影响后需输入

# 面向对象

## 类的定义

```cpp
class classname   //calss 关键字
{
    Access specifiers: //访问修饰符：private/public/protected
    		Date members/variables; //变量
    		Member function(){} //方法
}

class Box
{
    public: //确定类成员的访问属性
    	double length; //盒子长度
    	double breadth; //盒子宽度
    	double height; //盒子高度
};

//成员声明
Box Box1,Box2;    // 声明 Box1,Box2  类型为 Box
```

## 继承/派生

```cpp
//基类
class Animal {
    eat();
    sleep();
};

//派生
class Dog : public Animal{
    bark();
};
```

```cpp
#include<iostream>
using namespace std;
class Shape
{
    public:
    	void setWidth(int  w)
        {
            width = w;
        }
    	void setHeight(int h)
        {
            height = h;
        }
    protected:
    	int width;
    	int height;
};

class PaintCost
{
    public:
    	int getCost(int area)
        {
            return area*70;
        }
};

class Rectangle: public Shape,public PaintCost
    //  单/多继承
{
    public:
    	int getArea()
        {
            return (width*height);
        }
};

int main()
{
    Rectangle Rect;
    int area;
    Rect.setWidth(5);
    Rect.setHeight(7);
    area = Rect.getArea();
    cout << Rect.getArea() << endl;
    cout << Rect.getCost(area) << endl;
    return 0;
}
```

访问 | public | protected | private
---|---|---|---
同一个类 | yes | yes | yes
派生类 | yes | yes | no
外部的类 | yes | no | no

  * **公有继承（public）：** 当一个类派生自**公有** 基类时，基类的**公有** 成员也是派生类的**公有** 成员，基类的**保护** 成员也是派生类的**保护** 成员，基类的**私有** 成员不能直接被派生类访问，但是可以通过调用基类的**公有** 和**保护** 成员来访问。

  * **保护继承（protected）：** 当一个类派生自**保护** 基类时，基类的**公有** 和**保护** 成员将成为派生类的**保护** 成员。

  * **私有继承（private）：** 当一个类派生自**私有** 基类时，基类的**公有** 和**保护** 成员将成为派生类的**私有** 成员。

## 重载运算符与重载函数

# stack（栈）

  1. push(): 向栈内压入一个成员；
  2. pop(): 从栈顶弹出一个成员；
  3. empty(): 如果栈为空返回true，否则返回false；
  4. top(): 返回栈顶，但不删除成员；
  5. size(): 返回栈内元素的大小；

```cpp
#include <iostream>
#include <stack>
using namespace std;

int main()
{
    stack <int> stk;
    int i=12;
    cout << stk.empty() << endl;
    stk.push(i);
    cout << stk.size() << endl;
    cout << stk.empty() << endl;
    stk.pop();
    cout << stk.size() << endl;
    cout << stk.empty()<< endl;
}
/*结果：
1
1
0
0
1
*/
```
