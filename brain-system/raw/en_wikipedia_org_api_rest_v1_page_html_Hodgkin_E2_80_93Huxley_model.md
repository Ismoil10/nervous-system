---
source_url: "https://en.wikipedia.org/api/rest_v1/page/html/Hodgkin%E2%80%93Huxley_model"
type: webpage
title: "Hodgkin–Huxley model"
captured_at: 2026-10-31T12:20:02.494410+00:00
contributor: "Claude"
---

# Hodgkin–Huxley model

Source: https://en.wikipedia.org/api/rest_v1/page/html/Hodgkin%E2%80%93Huxley_model

---

Hodgkin–Huxley model

Describes how neurons transmit electric signals



Basic components of Hodgkin–Huxley-type models which represent the biophysical characteristic of [cell membranes](./Cell_membrane "Cell membrane"). The [lipid bilayer](./Lipid_bilayer "Lipid bilayer") is poised as one can say as a [capacitance](./Capacitance "Capacitance") (*C*m). Voltage-gated and leak ion channels are represented by nonlinear (*g*n) and linear (*g*L) conductances, respectively. The electrochemical gradients driving the flow of ions are represented by batteries (E), and ion pumps and exchangers are represented by current sources (*I*p).

The **Hodgkin–Huxley model**, or **conductance-based model**, is a [mathematical model](./Mathematical_model "Mathematical model") that shows why and how [action potentials](./Action_potential "Action potential") in [neurons](./Neuron "Neuron") are initiated and propagated. It is a set of [nonlinear differential equations](./Nonlinear_system#Nonlinear_differential_equations "Nonlinear system") that approximates the [electrical engineering](./Electrical_engineering "Electrical engineering") characteristics of [excitable cells](./Excitable_cell "Excitable cell") such as neurons and [muscle cells](./Muscle_cell "Muscle cell"). It is a continuous-time [dynamical system](./Dynamical_system "Dynamical system").

[Alan Hodgkin](./Alan_Hodgkin "Alan Hodgkin") and [Andrew Huxley](./Andrew_Huxley "Andrew Huxley") described the model in 1952 to explain the ionic mechanisms underlying the initiation and propagation of action potentials in the [squid giant axon](./Squid_giant_axon "Squid giant axon").[[1]](./Hodgkin–Huxley_model#cite_note-HH-1) They received the 1963 [Nobel Prize in Physiology or Medicine](./Nobel_Prize_in_Physiology_or_Medicine "Nobel Prize in Physiology or Medicine") for this work.

## Basic components

The typical Hodgkin–Huxley model treats each component of an excitable cell as an electrical element (as shown in the figure). The [lipid bilayer](./Lipid_bilayer "Lipid bilayer") is represented as a [capacitance](./Capacitance "Capacitance") (Cm). [Voltage-gated ion channels](./Voltage-gated_ion_channel "Voltage-gated ion channel") are represented by [electrical conductances](./Electrical_conductance "Electrical conductance") (*g**n*, where *n* is the specific ion channel) that depend on both voltage and time. [Leak channels](./Leak_channel "Leak channel") are represented by linear conductances (*g**L*). The [electrochemical gradients](./Electrochemical_gradient "Electrochemical gradient") driving the flow of ions are represented by [voltage sources](./Voltage_source "Voltage source") (*E**n*) whose [voltages](./Voltage "Voltage") are determined by the ratio of the intra- and extracellular concentrations of the ionic species of interest. Finally, [ion pumps](./Ion_pump_(biology) "Ion pump (biology)") are represented by [current sources](./Current_sources "Current sources") (*I**p*).[*[clarification needed](./Wikipedia:Please_clarify "Wikipedia:Please clarify")*] The [membrane potential](./Membrane_potential "Membrane potential") is denoted by *Vm*.

Mathematically, the current flowing into the capacitance of the lipid bilayer is written as

:   I

    c
    =

    C

    m





    d

    V

    m



    d
    t
    {\displaystyle I\_{c}=C\_{m}{\frac {{\mathrm {d} }V\_{m}}{{\mathrm {d} }t}}}

and the current through a given ion channel is the product of that channel's conductance and the driving potential for the specific ion

:   I

    i
    =


    g

    i
    (

    V

    m
    −

    V

    i
    )

    {\displaystyle I\_{i}={g\_{i}}(V\_{m}-V\_{i})\;}

where 




V

i
{\displaystyle V\_{i}}
 is the [reversal potential](./Reversal_potential "Reversal potential") of the specific ion channel.
Thus, for a cell with sodium and potassium channels, the total current through the membrane is given by:

:   I
    =

    C

    m





    d

    V

    m



    d
    t
    +

    g

    K
    (

    V

    m
    −

    V

    K
    )
    +

    g

    N
    a
    (

    V

    m
    −

    V

    N
    a
    )
    +

    g

    l
    (

    V

    m
    −

    V

    l
    )
    {\displaystyle I=C\_{m}{\frac {{\mathrm {d} }V\_{m}}{{\mathrm {d} }t}}+g\_{K}(V\_{m}-V\_{K})+g\_{Na}(V\_{m}-V\_{Na})+g\_{l}(V\_{m}-V\_{l})}

where *I* is the total membrane current per unit area, *C**m* is the membrane capacitance per unit area, *g**K* and *g**Na* are the [potassium](./Potassium "Potassium") and [sodium](./Sodium "Sodium") conductances per unit area, respectively, *V**K*  and *V**Na* are the potassium and sodium reversal potentials, respectively, and *g**l* and *V**l* are the leak conductance per unit area and leak reversal potential, respectively. The time dependent elements of this equation are *V**m*, *g**Na*, and *g**K*, where the last two conductances depend explicitly on the membrane voltage (*V**m*) as well.

## Ionic current characterization

In voltage-gated ion channels, the channel conductance is a function of both time and voltage (




g

n
(
t
,
V
)
{\displaystyle g\_{n}(t,V)}
 in the figure), while in leak channels, 




g

l
{\displaystyle g\_{l}}
, it is a constant (




g

L
{\displaystyle g\_{L}}
 in the figure). The current generated by ion pumps is dependent on the ionic species specific to that pump. The following sections will describe these formulations in more detail.

### Voltage-gated ion channels

Using a series of [voltage clamp](./Voltage_clamp "Voltage clamp") experiments and by varying extracellular sodium and potassium concentrations, Hodgkin and Huxley developed a model in which the properties of an excitable cell are described by a set of four [ordinary differential equations](./Ordinary_differential_equation "Ordinary differential equation").[[1]](./Hodgkin–Huxley_model#cite_note-HH-1) Together with the equation for the total current mentioned above, these are:

:   I
    =

    C

    m





    d

    V

    m



    d
    t
    +




    g
    ¯

    K

    n

    4
    (

    V

    m
    −

    V

    K
    )
    +




    g
    ¯

    Na

    m

    3
    h
    (

    V

    m
    −

    V

    N
    a
    )
    +




    g
    ¯

    l
    (

    V

    m
    −

    V

    l
    )
    ,
    {\displaystyle I=C\_{m}{\frac {{\mathrm {d} }V\_{m}}{{\mathrm {d} }t}}+{\bar {g}}\_{\text{K}}n^{4}(V\_{m}-V\_{K})+{\bar {g}}\_{\text{Na}}m^{3}h(V\_{m}-V\_{Na})+{\bar {g}}\_{l}(V\_{m}-V\_{l}),}

:   d
    n

    d
    t
    =

    α

    n
    (

    V

    m
    )
    (
    1
    −
    n
    )
    −

    β

    n
    (

    V

    m
    )
    n
    {\displaystyle {\frac {dn}{dt}}=\alpha \_{n}(V\_{m})(1-n)-\beta \_{n}(V\_{m})n}

:   d
    m

    d
    t
    =

    α

    m
    (

    V

    m
    )
    (
    1
    −
    m
    )
    −

    β

    m
    (

    V

    m
    )
    m
    {\displaystyle {\frac {dm}{dt}}=\alpha \_{m}(V\_{m})(1-m)-\beta \_{m}(V\_{m})m}

:   d
    h

    d
    t
    =

    α

    h
    (

    V

    m
    )
    (
    1
    −
    h
    )
    −

    β

    h
    (

    V

    m
    )
    h
    {\displaystyle {\frac {dh}{dt}}=\alpha \_{h}(V\_{m})(1-h)-\beta \_{h}(V\_{m})h}

where *I* is the current per unit area and 




α

i
{\displaystyle \alpha \_{i}}
 and 




β

i
{\displaystyle \beta \_{i}}
 are rate constants for the *i*-th ion channel, which depend on voltage but not time. 







g
¯

n
{\displaystyle {\bar {g}}\_{n}}
 is the maximal value of the conductance. *n*, *m*, and *h* are dimensionless probabilities between 0 and 1 that are associated with potassium channel [subunit](./Protein_subunit "Protein subunit") activation, sodium channel subunit activation, and sodium channel subunit inactivation, respectively. For instance, given that potassium channels in squid giant axon are made up of four subunits which all need to be in the open state for the channel to allow the passage of potassium ions, the *n* needs to be raised to the fourth power. For 



p
=
(
n
,
m
,
h
)
{\displaystyle p=(n,m,h)}
, 




α

p
{\displaystyle \alpha \_{p}}
 and 




β

p
{\displaystyle \beta \_{p}}
 take the form

:   α

    p
    (

    V

    m
    )
    =

    p

    ∞
    (

    V

    m
    )

    /

    τ

    p
    {\displaystyle \alpha \_{p}(V\_{m})=p\_{\infty }(V\_{m})/\tau \_{p}}

:   β

    p
    (

    V

    m
    )
    =
    (
    1
    −

    p

    ∞
    (

    V

    m
    )
    )

    /

    τ

    p
    .
    {\displaystyle \beta \_{p}(V\_{m})=(1-p\_{\infty }(V\_{m}))/\tau \_{p}.}

p

∞
{\displaystyle p\_{\infty }}
 and 



(
1
−

p

∞
)
{\displaystyle (1-p\_{\infty })}
 are the steady frontal values for activation and inactivation, respectively, and are usually represented by [Boltzmann equations](./Boltzmann_equation "Boltzmann equation") as functions of 




V

m
{\displaystyle V\_{m}}
. In the original paper by Hodgkin and Huxley,[[1]](./Hodgkin–Huxley_model#cite_note-HH-1) the functions 



α
{\displaystyle \alpha }
 and 



β
{\displaystyle \beta }
 are given by

:   α

    n
    (

    V

    m
    )
    =



    0.01
    (
    10
    −
    V
    )

    exp
    ⁡


    (



    10
    −
    V
    10


    )
    −
    1


    α

    m
    (

    V

    m
    )
    =



    0.1
    (
    25
    −
    V
    )

    exp
    ⁡


    (



    25
    −
    V
    10


    )
    −
    1


    α

    h
    (

    V

    m
    )
    =
    0.07
    exp
    ⁡


    (
    −


    V
    20


    )



    β

    n
    (

    V

    m
    )
    =
    0.125
    exp
    ⁡


    (
    −


    V
    80


    )


    β

    m
    (

    V

    m
    )
    =
    4
    exp
    ⁡


    (
    −


    V
    18


    )


    β

    h
    (

    V

    m
    )
    =


    1

    exp
    ⁡


    (



    30
    −
    V
    10


    )
    +
    1
    {\displaystyle {\begin{array}{lll}\alpha \_{n}(V\_{m})={\frac {0.01(10-V)}{\exp {\big (}{\frac {10-V}{10}}{\big )}-1}}&\alpha \_{m}(V\_{m})={\frac {0.1(25-V)}{\exp {\big (}{\frac {25-V}{10}}{\big )}-1}}&\alpha \_{h}(V\_{m})=0.07\exp {\bigg (}-{\frac {V}{20}}{\bigg )}\\\beta \_{n}(V\_{m})=0.125\exp {\bigg (}-{\frac {V}{80}}{\bigg )}&\beta \_{m}(V\_{m})=4\exp {\bigg (}-{\frac {V}{18}}{\bigg )}&\beta \_{h}(V\_{m})={\frac {1}{\exp {\big (}{\frac {30-V}{10}}{\big )}+1}}\end{array}}}

where 



V
=

V

r
e
s
t
−

V

m
{\displaystyle V=V\_{rest}-V\_{m}}
 denotes the negative depolarization in mV.

In many current software programs [[2]](./Hodgkin–Huxley_model#cite_note-2)
Hodgkin–Huxley type models generalize 



α
{\displaystyle \alpha }
 and 



β
{\displaystyle \beta }
 to

:   A

    p
    (

    V

    m
    −

    B

    p
    )

    exp
    ⁡


    (




    V

    m
    −

    B

    p

    C

    p


    )
    −

    D

    p
    {\displaystyle {\frac {A\_{p}(V\_{m}-B\_{p})}{\exp {\big (}{\frac {V\_{m}-B\_{p}}{C\_{p}}}{\big )}-D\_{p}}}}

In order to characterize voltage-gated channels, the equations can be fitted to voltage clamp data. For a derivation of the Hodgkin–Huxley equations under voltage-clamp, see.[[3]](./Hodgkin–Huxley_model#cite_note-JohnstonAndWu-3) Briefly, when the membrane potential is held at a constant value (i.e., with a voltage clamp), for each value of the membrane potential the nonlinear gating equations reduce to equations of the form:

:   m
    (
    t
    )
    =

    m

    0
    −
    [
    (

    m

    0
    −

    m

    ∞
    )
    (
    1
    −

    e

    −
    t

    /

    τ

    m
    )
    ]

    {\displaystyle m(t)=m\_{0}-[(m\_{0}-m\_{\infty })(1-e^{-t/\tau \_{m}})]\,}

:   h
    (
    t
    )
    =

    h

    0
    −
    [
    (

    h

    0
    −

    h

    ∞
    )
    (
    1
    −

    e

    −
    t

    /

    τ

    h
    )
    ]

    {\displaystyle h(t)=h\_{0}-[(h\_{0}-h\_{\infty })(1-e^{-t/\tau \_{h}})]\,}

:   n
    (
    t
    )
    =

    n

    0
    −
    [
    (

    n

    0
    −

    n

    ∞
    )
    (
    1
    −

    e

    −
    t

    /

    τ

    n
    )
    ]

    {\displaystyle n(t)=n\_{0}-[(n\_{0}-n\_{\in
