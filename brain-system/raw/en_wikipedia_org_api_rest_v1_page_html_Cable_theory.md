---
source_url: "https://en.wikipedia.org/api/rest_v1/page/html/Cable_theory"
type: webpage
title: "Cable theory"
captured_at: 2026-10-31T12:20:08.492857+00:00
contributor: "Claude"
---

# Cable theory

Source: https://en.wikipedia.org/api/rest_v1/page/html/Cable_theory

---

Cable theory

Mathematical model of a dendrite



Figure. 1: Cable theory's simplified view of a neuronal fiber

In [neuroscience](./Neuroscience "Neuroscience"), classical **cable theory** uses [mathematical models](./Mathematical_model "Mathematical model") to calculate the [electric current](./Electric_current "Electric current") (and accompanying [voltage](./Voltage "Voltage")) along passive[[a]](./Cable_theory#cite_note-classical-1) [neurites](./Neurite "Neurite"), particularly the [dendrites](./Dendrite "Dendrite") that receive [synaptic](./Synapse "Synapse") inputs at different sites and times. Estimates are made by modeling dendrites and [axons](./Axons "Axons") as cylinders composed of segments with [capacitances](./Capacitance "Capacitance") 




c

m
{\displaystyle c\_{m}}
 and [resistances](./Electrical_resistance "Electrical resistance") 




r

m
{\displaystyle r\_{m}}
 combined in parallel (see Fig. 1). The capacitance of a neuronal fiber comes about because [electrostatic](./Electrostatic "Electrostatic") forces are acting through the very thin lipid bilayer (see Figure 2). The resistance in series along the fiber 




r

l
{\displaystyle r\_{l}}
 is due to the [axoplasm](./Axoplasm "Axoplasm")'s significant resistance to movement of [electric charge](./Electric_charge "Electric charge").

Figure. 2: Fiber capacitance

## History

Cable theory in computational [neuroscience](./Neuroscience "Neuroscience") has roots leading back to the 1850s, when Professor [William Thomson](./William_Thomson,_1st_Baron_Kelvin "William Thomson, 1st Baron Kelvin") (later known as Lord Kelvin) began developing mathematical models of signal decay in submarine (underwater) telegraphic cables. The models resembled the partial differential equations used by [Fourier](./Joseph_Fourier "Joseph Fourier") to describe heat conduction in a wire.

The 1870s saw the first attempts by Hermann to model [neuronal](./Neuronal "Neuronal") [electrotonic potentials](./Electrotonic_potential "Electrotonic potential") also by focusing on analogies with heat conduction. However, it was Hoorweg who first discovered the analogies with Kelvin's undersea cables in 1898 and then Hermann and Cremer who independently developed the cable theory for neuronal fibers in the early 20th century. Further mathematical theories of nerve fiber conduction based on cable theory were developed by Cole and [Hodgkin](./Alan_Lloyd_Hodgkin "Alan Lloyd Hodgkin") (1920s–1930s), Offner et al. (1940), and Rushton (1951).

Experimental evidence for the importance of cable theory in modelling the behavior of [axons](./Axons "Axons") began surfacing in the 1930s from work done by Cole, Curtis, Hodgkin, [Sir Bernard Katz](./Sir_Bernard_Katz "Sir Bernard Katz"), Rushton, Tasaki and others. Two key papers from this era are those of Davis and [Lorente de Nó](./Rafael_Lorente_de_Nó "Rafael Lorente de Nó") (1947) and Hodgkin and Rushton (1946).

The 1950s saw improvements in techniques for measuring the electric activity of individual [neurons](./Neurons "Neurons"). Thus cable theory became important for analyzing data collected from intracellular microelectrode recordings and for analyzing the electrical properties of neuronal [dendrites](./Dendrites "Dendrites"). Scientists like Coombs, [Eccles](./John_Eccles_(neurophysiologist) "John Eccles (neurophysiologist)"), Fatt, Frank, Fuortes and others now relied heavily on cable theory to obtain functional insights of neurons and for guiding them in the design of new experiments.

Later, cable theory with its mathematical derivatives allowed ever more sophisticated [neuron models](./Biological_neuron_model "Biological neuron model") to be explored by workers such as Jack, [Rall](./Wilfrid_Rall "Wilfrid Rall"), Redman, Rinzel, Idan Segev, Tuckwell, Bell, and Iannella. More recently, cable theory has been applied to model electrical activity in bundled neurons in the white matter of the brain.[[1]](./Cable_theory#cite_note-2)

## Deriving the cable equation

Note, various conventions of *r**m* exist.
Here *r**m* and *c**m*, as introduced above, are measured per membrane-length unit (per meter (m)). Thus *r**m* is measured in [ohm](./Ohm "Ohm")·meters (Ω·m) and *c**m* in [farads](./Farad "Farad") per meter (F/m). This is in contrast to *R**m* (in Ω·m2) and *C**m* (in F/m2), which represent the specific resistance and capacitance respectively of one unit area of membrane (in m2). Thus, if the radius, *a*, of the axon is known,[[b]](./Cable_theory#cite_note-fiberradius-3) then its circumference is 2*πa*, and its *r**m*, and its *c**m* values can be calculated as:

|  |  |  |
| --- | --- | --- |
| r  m =    R  m  2 π a   {\displaystyle r\_{m}={\frac {R\_{m}}{2\pi a\ }}} |  | 1 |

|  |  |  |
| --- | --- | --- |
| c  m =  C  m 2 π a   {\displaystyle c\_{m}=C\_{m}2\pi a\ } |  | 2 |

These relationships make sense intuitively, because the greater the circumference of the axon, the greater the area for charge to escape through its membrane, and therefore the lower the membrane resistance (dividing *R**m* by 2*πa*); and the more membrane available to store charge (multiplying *C**m* by 2*πa*).
The [specific electrical resistance](./Specific_electrical_resistance "Specific electrical resistance"), *ρ**l*, of the axoplasm allows one to calculate the longitudinal intracellular resistance per unit length, *r**l*, (in Ω·m−1) by the equation:

|  |  |  |
| --- | --- | --- |
| r  l =    ρ  l  π  a  2   {\displaystyle r\_{l}={\frac {\rho \_{l}}{\pi a^{2}\ }}} |  | 3 |

The greater the cross sectional area of the axon, *πa*2, the greater the number of paths for the charge to flow through its axoplasm, and the lower the axoplasmic resistance.

Several important avenues of extending classical cable theory have recently seen the introduction of endogenous structures in order to analyze the effects of protein polarization within dendrites and different synaptic input distributions over the dendritic surface of a neuron.

To better understand how the cable equation is derived, first consider an idealized neuron with a perfectly sealed membrane (*r**m*=∞) with no loss of current to the outside, and no capacitance (*c**m* = 0). A current injected into the fiber [[c]](./Cable_theory#cite_note-linearity-4) at position *x* = 0 would move along the inside of the fiber unchanged. Moving away from the point of injection and by using [Ohm's law](./Ohm's_law "Ohm's law") (*V* = *IR*) we can calculate the voltage change as:

|  |  |  |
| --- | --- | --- |
| Δ V = −  i  l  r  l Δ x   {\displaystyle \Delta V=-i\_{l}r\_{l}\Delta x\ } |  | 4 |

where the negative is because current flows down the potential gradient.

Letting Δ*x* go towards zero and having infinitely small increments of *x*, one can write (**[4](./Cable_theory#math_4)**) as:

|  |  |  |
| --- | --- | --- |
| ∂ V  ∂ x = −  i  l  r  l   {\displaystyle {\frac {\partial V}{\partial x}}=-i\_{l}r\_{l}\ } |  | 5 |

or

|  |  |  |
| --- | --- | --- |
| 1  r  l    ∂ V  ∂ x = −  i  l   {\displaystyle {\frac {1}{r\_{l}}}{\frac {\partial V}{\partial x}}=-i\_{l}\ } |  | 6 |

Bringing *r**m* back into the picture is like making holes in a garden hose. The more holes, the faster the water will escape from the hose, and the less water will travel all the way from the beginning of the hose to the end. Similarly, in an axon, some of the current traveling longitudinally through the axoplasm will escape through the membrane.

If *i**m* is the current escaping through the membrane per length unit, m, then the total current escaping along *y* units must be *y·i**m*. Thus, the change of current in the axoplasm, Δ*i**l*, at distance, Δ*x*, from position *x*=0 can be written as:

|  |  |  |
| --- | --- | --- |
| Δ  i  l = −  i  m Δ x   {\displaystyle \Delta i\_{l}=-i\_{m}\Delta x\ } |  | 7 |

or, using continuous, infinitesimally small increments:

|  |  |  |
| --- | --- | --- |
| ∂  i  l  ∂ x = −  i  m   {\displaystyle {\frac {\partial i\_{l}}{\partial x}}=-i\_{m}\ } |  | 8 |

i

m
{\displaystyle i\_{m}}
 can be expressed with yet another formula, by including the capacitance. The capacitance will cause a flow of charge (a current) towards the membrane on the side of the cytoplasm. This current is usually referred to as displacement current (here denoted 




i

c
{\displaystyle i\_{c}}
.) The flow will only take place as long as the membrane's storage capacity has not been reached. 




i

c
{\displaystyle i\_{c}}
 can then be expressed as:

|  |  |  |
| --- | --- | --- |
| i  c =  c  m    ∂ V  ∂ t   {\displaystyle i\_{c}=c\_{m}{\frac {\partial V}{\partial t}}\ } |  | 9 |

where 




c

m
{\displaystyle c\_{m}}
 is the membrane's capacitance and 




∂
V

/

∂
t
{\displaystyle {\partial V}/{\partial t}}
 is the change in voltage over time.
The current that passes the membrane (




i

r
{\displaystyle i\_{r}}
) can be expressed as:

|  |  |  |
| --- | --- | --- |
| i  r =   V  r  m {\displaystyle i\_{r}={\frac {V}{r\_{m}}}} |  | 10 |

and because 




i

m
=

i

r
+

i

c
{\displaystyle i\_{m}=i\_{r}+i\_{c}}
 the following equation for 




i

m
{\displaystyle i\_{m}}
 can be derived if no additional current is added from an electrode:

|  |  |  |
| --- | --- | --- |
| ∂  i  l  ∂ x = −  i  m = − (   V  r  m +  c  m    ∂ V  ∂ t ) {\displaystyle {\frac {\partial i\_{l}}{\partial x}}=-i\_{m}=-({\frac {V}{r\_{m}}}+c\_{m}{\frac {\partial V}{\partial t}})} |  | 11 |

where 




∂

i

l

/

∂
x
{\displaystyle {\partial i\_{l}}/{\partial x}}
 represents the change per unit length of the longitudinal current.

Combining equations (**[6](./Cable_theory#math_6)**) and (**[11](./Cable_theory#math_11)**) gives a first version of a cable equation:

|  |  |  |
| --- | --- | --- |
| 1  r  l     ∂  2 V  ∂  x  2 =  c  m    ∂ V  ∂ t +   V  r  m {\displaystyle {\frac {1}{r\_{l}}}{\frac {\partial ^{2}V}{\partial x^{2}}}=c\_{m}{\frac {\partial V}{\partial t}}+{\frac {V}{r\_{m}}}} |  | 12 |

which is a second-order [partial differential equation](./Partial_differential_equation "Partial differential equation") (PDE).

By a simple rearrangement of equation (**[12](./Cable_theory#math_12)**) (see later) it is possible to make two important terms appear, namely the length constant (sometimes referred to as the space constant) denoted 



λ
{\displaystyle \lambda }
 and the time constant denoted 



τ
{\displaystyle \tau }
. The following sections focus on these terms.

## Length constant

Main article: [Length constant](./Length_constant "Length constant")

The length constant, 



λ
{\displaystyle \lambda }
 (lambda), is a parameter that indicates how far a stationary current will influence the voltage along the cable. The larger the value of 



λ
{\displaystyle \lambda }
, the farther the charge will flow. The length constant can be expressed as:

|  |  |  |
| --- | --- | --- |
| λ =     r  m  r  l {\displaystyle \lambda ={\sqrt {\frac {r\_{m}}{r\_{l}}}}} |  | 13 |

The larger the membrane resistance, *r**m*, the greater the value of 



λ
{\displaystyle \lambda }
, and the more current will remain inside the axoplasm to travel longitudinally through the axon. The higher the axoplasmic resistance, 




r

l
{\displaystyle r\_{l}}
, the smaller the value of 



λ
{\displaystyle \lambda }
, the harder it will be for current to travel through the axoplasm, and the shorter the current will be able to travel.
It is possible to solve equation (**[12](./Cable_theory#math_12)**) and arrive at the following equation (which is valid in steady-state conditions, i.e. when time approaches infinity):

|  |  |  |
| --- | --- | --- |
| V  x =  V  0  e  −   x λ {\displaystyle V\_{x}=V\_{0}e^{-{\frac {x}{\lambda }}}} |  | 14 |

Where 




V

0
{\displaystyle V\_{0}}
 is the depolarization at 



x
=
0
{\displaystyle x=0}
 (point of current injection), *e* is the exponential constant (approximate value 2.71828) and 




V

x
{\displaystyle V\_{x}}
 is the voltage at a given distance *x* from *x*=0. When 



x
=
λ
{\display
