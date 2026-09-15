---
title: "C语言指针强化（更新中）"
description: "指针的宽度、声明、赋值、类型转换与寻址的整理笔记，含结构体内存对齐与数组指针的实例。"
pubDate: "2020-11-04"
category: "正文"
cover: ""
status: published
tags:
  - C语言
  - 指针
links:
  - C语言笔记(初学)
  - C与指针
references: []
original_url: "https://soft-fang.github.io/2020/11/04/C语言指针强化/"
---

## 指针类型的宽度

  * 无论原来类型的宽度是多少，在64位程序下，宽度均为8字节

  * 无论多少个*，均为8个字节

一级指针char*

二级指针char**

三级指针char***

**一级指针是用于对数据的更新, 那么二级指针就是用于对数据地址的更新. 以此类推, 三级指针就是对数据地址的地址的更新…**

## 指针类型的声明

1.带有 * 的变量类型的标准写法：变量类型 * 变量名

2.任何类型都可以带 * ，加上 * 以后都是新类型

3.* 可以是任意多个

4.带 * 类型的变量，可以通过在其变量前加 * 来获取其指向内存中存储的值。

5.在带 * 类型的变量前面加 * ，类型是其原来的类型减去一个 * 。

## 指针类型的赋值

```c
int* a;
char* b;
short* c;
a=(int*)1;
b=(char*)2;
c=(short*)3;
```

```c
int main()
{
	char* a;
	short* b;
	int* c;
	a=(char*)100;
	b=(short*)100;
	c=(int*)100;
	printf("%d\n",a++);
	printf("%d\n",b++);
	printf("%d\n",c++);
	system("pause");
	return 0;
 }
```

a,b,c作为指针，也可以被赋值（上文被赋为100）进行加减，但是不能乘除。

在下面进行运算时（以a为例）

a++ == 100 =>> 先输出a，在进行a+1

++a == 101 =>> 先进行a+1，再输出a

a+2 == 102 =>> 指针进行加减时+n表示增加n个此类型（此处是char，*_要剪掉一个 * ，以此类推*_ ）的宽度（char 1个字节宽度 short 2个字节宽度 某类型* 8个字节…）

*_某类型 **_
在C语言底层是被看作一个新的类型的
不仅仅是一个保存地址的东西

## &符号说明

  * &是地址符，类型是其后面的类型加一个“*”，任何变量都可以使用&来获取地址，但不能用在常量上

int* a

c=&a =>c=int** a;

## 指针类型的求差值

```c
int* a;
int* b;
a=(int*)200;
b=(int*)100;

//a-b=25
//两者数值相减后除以其类型宽度
//指针类型可以做比较
```

## 类型转换

  * 基本类型之间可以转换

  * 指针类型指针不能相互转换，但是可以强转 ↓

```c
char* a;
int* c;
a=(char*)100;
c=(int*)a;
printf("%d\n",c);
```

能强转的原因是类型char* 与int* 的宽度相同

## 指针类型的继续理解

### 搜索字符串

```c
char a[]={
    0x1,0x2,0x3,0x4,0x5,0x6,0x7,0x8,0x9,0xA,
    0x1,0x2,0x3,0x4,0x5,0x6,0x7,0x8,0x9,0xA,
    0x1,0x2,0x3,0x4,0x5,0x6,0x7,0x8,0x9,0xA,
    0x1,0x2,0x3,0x4,0x5,0x6,0x7,0x8,0x9,0xA,
    0x1,0x2,0x3,0x4,0x5,0x6,0x7,0x8,0x9,0xA,
    0x1,0x2,0x3,0x4,0x5,0x6,0x7,0x8,0x9,0xA,
    0x1,0x2,0x3,0x4,0x5,0x6,0x7,0x8,0x9,0xA,
    0x1,0x2,0x3,0x4,0x5,0x6,0x7,0x8,0x9,0xA,
    0x1,0x2,0x3,0x4,0x5,0x6,0x7,0x8,0x9,0xA,
    0x1,0x2,0x3,0x4,0x5,0x6,0x7,0x8,0x9,0xA,
}
int main()
{
    char *Pchar;
    Pchar = (char*)a;
    for(int i=0;i<100;i++)
    {
        if(*Pchar == 0x5)
        {
            printf("%x\n",Pchar);
        }
        Pchar++;

    }
}
```

在以上程序中Pchar++以后，将从0x1跳到0x2

如果把char *Pchar换成int，那么就需要把

0x5,0x6,0x7,0x8===>0x5,0x0,0x0,0x0

才能检测到0x5的地址，因为int是4个字节

### 结构体指针（有关系到数据结构）

**typedef struct 结构名{ }别名** （struct表示定义一个结构体，typedef表示在接下来的程序中可以不用声明struct而是直接用别名来申请变量）

```c
typedef struct student{
	int id;
    int age;
}Stu;

int main()
{
    Stu a;
    printf("%d\n",sizeof(a));
}//a的字符长度为8
```

```c
char id;
int age;
//则a的字符长度为8
```

```c
char id;
int age;
char sex;
//则a的字符长度为12
```

```c
char id;
char sex;
int age;
//则a的字符长度为8（神奇！！）
```

原因：计算机一般默认一次读取4个字节(运行最快)

先放入char （一个字节），发现后面剩3个放不下int于是再加4个字节

4+4=8（）以此类推（牺牲空间，加快速度）

id |  |  |
---|---|---|---
age |  |  |
id |  |  |
---|---|---|---
age |  |  |
sex |  |  |
id | age |  |
---|---|---|---
age |  |  |

```c
#pragma pack(1)//人为规定一次读取1个字节（为了不浪费空间）
typedef struct student{
	char id;
    char sex;
    int age;
}Stu;
#pragma pack()
int main()
{
    Stu a;
    printf("%d\n",sizeof(a));
}//a的字符长度为6
```

## 指针寻址的理解

```c
*(p+0) = *p =p[0];
*(p+1) = p[1];
*(p+i) = p[i];
//以此类推
---
char (*pchar)[10] = (char(*)[10])a;//数组指针
char* parr[10];//指针数组
printf("%X\n",*(*(pchar+1)+4));//*(pchar+i)=pchar[i]   *(*(pchar+i)+j)=pchar[i][j]
```
